let stopped = false;

const NET_NAME = 'HILBERT';
const LAYER_TOP = 1;
const LAYER_BOTTOM = 2;

/** 铜在 20℃ 的电阻率，Ω·mm²/m */
const RHO_20 = 0.01724;
/** 铜的电阻温度系数，1/℃ */
const ALPHA = 0.00393;

function stopDrawing() {
	stopped = true;
}

/**
 * 计算网格参数
 *
 * 步距 = 线宽 + 间距；列数/行数由区域宽高按步距取整得到。
 * 横纵步距一致，所以格子永远是正方形，矩形区域靠行列数铺满，而不是把格子拉长。
 *
 * @param options - 界面参数
 * @returns 网格参数
 */
function calcGrid(options) {
	const lineWidth = Number(options.lineWidth);
	const gap = Number(options.gap);
	const width = Number(options.width);
	const height = Number(options.height);

	if (!(lineWidth > 0)) {
		throw new Error('线宽必须大于 0');
	}
	if (!(gap >= 0)) {
		throw new Error('间距不能小于 0');
	}
	if (!(width > 0) || !(height > 0)) {
		throw new Error('区域宽度和高度都必须大于 0');
	}

	const pitchMm = lineWidth + gap;
	const pitch = eda.sys_Unit.mmToMil(pitchMm);
	const widthMil = eda.sys_Unit.mmToMil(width);
	const heightMil = eda.sys_Unit.mmToMil(height);
	// +1e-6 吸收浮点误差，避免 20 / 0.4 = 49.999… 被 floor 成 49
	const cols = Math.floor(widthMil / pitch + 1e-6) + 1;
	const rows = Math.floor(heightMil / pitch + 1e-6) + 1;

	if (cols < 2 || rows < 2) {
		throw new Error('区域放不下一个步距（' + pitchMm.toFixed(3) + ' mm），请减小线宽/间距或加大区域');
	}
	if (cols * rows > 40000) {
		throw new Error('网格过大（' + cols + ' × ' + rows + ' 格），请加大间距或缩小区域');
	}

	return {
		cols: cols,
		rows: rows,
		pitch: pitch,
		pitchMm: pitchMm,
		realWidthMm: (cols - 1) * pitchMm,
		realHeightMm: (rows - 1) * pitchMm,
	};
}

/**
 * 铜箔电阻
 *
 * R = ρ(T) · L / (w · t)，其中 ρ(T) = ρ20 · (1 + α · (T - 20))。
 * 代入 Ω·mm²/m 与 mm / μm 后化简为 0.01724 · L[mm] / (w[mm] · t[μm])。
 *
 * @param lengthMm - 铜箔总长（mm）
 * @param lineWidthMm - 线宽（mm）
 * @param copperUm - 铜厚（μm）
 * @param tempC - 温度（℃）
 * @returns 电阻（Ω）
 */
function copperResistance(lengthMm, lineWidthMm, copperUm, tempC) {
	if (!(lengthMm > 0) || !(lineWidthMm > 0) || !(copperUm > 0)) {
		return NaN;
	}
	const rho = RHO_20 * (1 + ALPHA * ((Number(tempC) || 20) - 20));
	return (rho * lengthMm) / (lineWidthMm * copperUm);
}

/**
 * 合并共线点
 *
 * 希尔伯特曲线里有大量连续同向的格子（一段直线跨好几格），
 * 合成一条线段后图元数量能少一半以上，绘制速度提升明显，几何形状完全不变。
 *
 * @param points - 原始点序列
 * @returns 简化后的点序列
 */
function simplify(points) {
	if (points.length < 3) {
		return points;
	}
	const out = [points[0]];
	for (let i = 1; i < points.length - 1; i += 1) {
		const prev = out[out.length - 1];
		const cur = points[i];
		const next = points[i + 1];
		const d1x = cur[0] - prev[0];
		const d1y = cur[1] - prev[1];
		const d2x = next[0] - cur[0];
		const d2y = next[1] - cur[1];
		// 叉积不为 0 说明方向变了，必须保留该点
		if (Math.abs(d1x * d2y - d1y * d2x) > 1e-9) {
			out.push(cur);
		}
	}
	out.push(points[points.length - 1]);
	return out;
}

/**
 * 规划曲线（只算坐标，不碰 EDA 图元）
 *
 * 双面错开时：
 * - 顶层从近端走到远端，在远端打一个过孔；
 * - 底层整体偏移半个步距（正好落在顶层的空隙里），从过孔绕回近端；
 * - 两端各引出一段线当接线端子，避免两个端子只隔半个步距没法焊接。
 *
 * @param options - 界面参数
 * @returns 绘制计划 \`{ grid, targets, via, lengthMil }\`
 */
function planCurve(options) {
	const grid = calcGrid(options);
	const cells = HilbertCore.buildPath({ cols: grid.cols, rows: grid.rows, mode: options.mode });
	const layers = options.layers;
	const p = grid.pitch;
	const half = p / 2;
	const staggered = layers === 'both' && options.offset !== false;
	const useVia = staggered && options.via !== false;
	const leadMil = eda.sys_Unit.mmToMil(Math.max(0, Number(options.lead) || 0));
	const viaDiaMm = Math.max(0.2, Number(options.viaDiameter) || 0.6);

	const cx = ((grid.cols - 1) * p) / 2;
	const cy = ((grid.rows - 1) * p) / 2;
	const last = cells[cells.length - 1];

	const top = [];
	const bottom = [];
	let via = null;

	if (staggered) {
		for (let i = 0; i < cells.length; i += 1) {
			top.push([cells[i][0] * p, cells[i][1] * p]);
		}
		if (useVia) {
			// 过孔放在区域外侧的对角方向，免得孔盘压到相邻走线
			const sx = last[0] * p - cx >= 0 ? 1 : -1;
			const sy = last[1] * p - cy >= 0 ? 1 : -1;
			const r = eda.sys_Unit.mmToMil(viaDiaMm / 2 + 0.15);
			via = { x: last[0] * p + sx * r * Math.SQRT1_2, y: last[1] * p + sy * r * Math.SQRT1_2 };
			top.push([via.x, via.y]);
			bottom.push([via.x, via.y]);
		}
		for (let i = cells.length - 1; i >= 0; i -= 1) {
			bottom.push([cells[i][0] * p + half, cells[i][1] * p + half]);
		}
		if (leadMil > 0) {
			// 顶层端子水平向外，底层端子竖直向外，两个端子自然拉开
			const t0 = top[0];
			const dirX = t0[0] - cx >= 0 ? 1 : -1;
			top.unshift([t0[0] + dirX * leadMil, t0[1]]);
			const q0 = bottom[bottom.length - 1];
			const dirY = q0[1] - cy >= 0 ? 1 : -1;
			bottom.push([q0[0], q0[1] + dirY * leadMil]);
		}
	} else {
		for (let i = 0; i < cells.length; i += 1) {
			top.push([cells[i][0] * p, cells[i][1] * p]);
		}
	}

	const single = top;
	const targets = [];
	if (layers !== 'bottom') {
		targets.push({ layer: LAYER_TOP, points: single });
	}
	if (layers !== 'top') {
		targets.push({ layer: LAYER_BOTTOM, points: staggered ? bottom : single });
	}

	for (let t = 0; t < targets.length; t += 1) {
		targets[t].points = simplify(targets[t].points);
	}

	let lengthMil = 0;
	for (let t = 0; t < targets.length; t += 1) {
		const points = targets[t].points;
		for (let i = 1; i < points.length; i += 1) {
			const dx = points[i][0] - points[i - 1][0];
			const dy = points[i][1] - points[i - 1][1];
			lengthMil += Math.sqrt(dx * dx + dy * dy);
		}
	}

	return { grid: grid, targets: targets, via: via, lengthMil: lengthMil, staggered: staggered };
}

/**
 * 绘制希尔伯特曲线
 *
 * @param options - 界面传入的参数
 * @returns 绘制结果 \`{ drawn, total, interrupted, cols, rows, pitchMm, lengthMm, vias }\`
 */
async function drawHilbertCurve(options) {
	const lineWidthMm = Number(options.lineWidth);
	if (!(lineWidthMm > 0)) {
		throw new Error('线宽必须大于 0');
	}

	const plan = planCurve(options);
	if (plan.via && !eda.pcb_PrimitiveVia) {
		throw new Error('当前 EDA 版本不支持过孔 API，请取消「过孔串联」');
	}

	// 获取数据原点与画布原点的偏移量
	const canvas = await eda.pcb_Document.getCanvasOrigin();
	const originX = canvas['offsetX'] + eda.sys_Unit.mmToMil(Number(options.startX) || 0);
	const originY = canvas['offsetY'] + eda.sys_Unit.mmToMil(Number(options.startY) || 0);

	// 临时解决方案，2.2.35.4 已修复
	const lineWidth = eda.sys_Unit.mmToMil(lineWidthMm);

	// 先把所有线段拍平，再分批并发提交，比逐段 await 快一个数量级
	const segments = [];
	for (let t = 0; t < plan.targets.length; t += 1) {
		const target = plan.targets[t];
		for (let i = 1; i < target.points.length; i += 1) {
			segments.push([
				target.layer,
				originX + target.points[i - 1][0],
				originY + target.points[i - 1][1],
				originX + target.points[i][0],
				originY + target.points[i][1],
			]);
		}
	}

	const total = segments.length;
	const CHUNK = 24;
	let drawn = 0;
	let vias = 0;
	try {
		for (let i = 0; i < segments.length; i += CHUNK) {
			if (stopped) {
				break;
			}
			const batch = [];
			const end = Math.min(i + CHUNK, segments.length);
			for (let k = i; k < end; k += 1) {
				const s = segments[k];
				batch.push(eda.pcb_PrimitiveLine.create(NET_NAME, s[0], s[1], s[2], s[3], s[4], lineWidth));
			}
			await Promise.all(batch);
			drawn += batch.length;
		}
		if (!stopped && plan.via) {
			await eda.pcb_PrimitiveVia.create(
				NET_NAME,
				originX + plan.via.x,
				originY + plan.via.y,
				eda.sys_Unit.mmToMil(Math.max(0.05, Number(options.viaHole) || 0.3)),
				eda.sys_Unit.mmToMil(Math.max(0.1, Number(options.viaDiameter) || 0.6)),
			);
			vias = 1;
		}
	} finally {
		// 无论成功、失败还是中断都要复位，否则下一次绘制会立即空转返回
		stopped = false;
	}

	return {
		drawn: drawn,
		total: total,
		interrupted: drawn < total,
		cols: plan.grid.cols,
		rows: plan.grid.rows,
		pitchMm: plan.grid.pitchMm,
		lengthMm: eda.sys_Unit.milToMm(plan.lengthMil),
		vias: vias,
	};
}

/**
 * 用 PCB 上实际网络的线长计算电阻
 *
 * @param options - 界面参数
 * @returns \`{ lengthMm, r20, rTemp, tempC }\`
 */
async function calcResistance(options) {
	const lengthMil = await eda.pcb_Net.getNetLength(NET_NAME);
	const lengthMm = eda.sys_Unit.milToMm(lengthMil);
	const lineWidthMm = Number(options.lineWidth);
	// 界面按 oz 输入，1 oz = 35 μm
	const copperUm = (Number(options.copper) || 1) * 35;
	const tempC = Number(options.temp) || 20;

	return {
		lengthMm: lengthMm,
		r20: copperResistance(lengthMm, lineWidthMm, copperUm, 20),
		rTemp: copperResistance(lengthMm, lineWidthMm, copperUm, tempC),
		tempC: tempC,
	};
}