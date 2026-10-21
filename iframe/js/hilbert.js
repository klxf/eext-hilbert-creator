/**
 * 希尔伯特曲线几何计算（矩形域）
 *
 * 纯计算，不依赖 EDA API，便于单独测试。
 *
 * 规则：
 * - 每个格子是一个顶点，相邻顶点相差一格，逐段连线即为曲线；
 * - 「列 × 行」矩形用四象限递归填充，正方形时与经典希尔伯特曲线一致；
 * - 象限无法均分或角点组合不可行时，退化为二分递归，因此任意尺寸都能填满。
 * - 同一尺寸往往有多种合法走法，形状差别很大：这里同时用两套构造生成候选，
 *   取「最长直线段最短」的那个，避免出现整行整列的梳状长条。
 */
(function (global) {
	'use strict';

	/** 绘制使用的网络名 */
	const NET_NAME = 'HILBERT';
	/** 顶层铜层 */
	const LAYER_TOP = 1;
	/** 底层铜层 */
	const LAYER_BOTTOM = 2;

	// 角点编号：0=左下 1=右下 2=左上 3=右上
	const SW = 0;
	const SE = 1;
	const NW = 2;
	const NE = 3;

	/** 角点对应的格子（相对区域左下角） */
	function cornerCell(corner, w, h) {
		return [corner === SE || corner === NE ? w - 1 : 0, corner === NW || corner === NE ? h - 1 : 0];
	}

	function colorOf(corner, w, h) {
		const cell = cornerCell(corner, w, h);
		return (cell[0] + cell[1]) % 2;
	}

	/** 角点组合是否可行（含单行/单列退化情形） */
	function validCorners(w, h, entry, exit) {
		if (w === 1 && h === 1) {
			return true;
		}
		if (w === 1 || h === 1) {
			const a = cornerCell(entry, w, h);
			const b = cornerCell(exit, w, h);
			const far = w === 1 ? Math.abs(a[1] - b[1]) : Math.abs(a[0] - b[0]);
			return far === (w === 1 ? h - 1 : w - 1);
		}
		const odd = (w * h) % 2 === 1;
		const same = colorOf(entry, w, h) === colorOf(exit, w, h);
		return odd ? same : !same;
	}

	/** 角点所属象限：0=左下 1=右下 2=右上 3=左上 */
	function quadrantOf(corner) {
		if (corner === SE) {
			return 1;
		}
		if (corner === NE) {
			return 2;
		}
		if (corner === NW) {
			return 3;
		}
		return 0;
	}

	/** 相邻象限之间的两个可选连接点，返回 [离开角, 进入角] */
	function junction(from, to, which) {
		const table = {
			'01': [
				[SE, SW],
				[NE, NW],
			],
			'10': [
				[SW, SE],
				[NW, NE],
			],
			'12': [
				[NW, SW],
				[NE, SE],
			],
			'21': [
				[SW, NW],
				[SE, NE],
			],
			'23': [
				[SW, SE],
				[NW, NE],
			],
			'32': [
				[SE, SW],
				[NE, NW],
			],
			'30': [
				[SW, NW],
				[SE, NE],
			],
			'03': [
				[NW, SW],
				[NE, SE],
			],
		};
		return table[String(from) + String(to)][which];
	}

	/** 拼接两个子路径，端点不匹配则返回 null */
	function concatPaths(parts, rects, corners) {
		const out = [];
		for (let i = 0; i < parts.length; i += 1) {
			const part = parts[i];
			if (!part || part.length === 0) {
				return null;
			}
			const rect = rects[i];
			const start = cornerCell(corners[i][0], rect[2], rect[3]);
			const end = cornerCell(corners[i][1], rect[2], rect[3]);
			if (part[0][0] - rect[0] !== start[0] || part[0][1] - rect[1] !== start[1]) {
				return null;
			}
			const last = part[part.length - 1];
			if (last[0] - rect[0] !== end[0] || last[1] - rect[1] !== end[1]) {
				return null;
			}
			if (out.length > 0) {
				const prev = out[out.length - 1];
				if (Math.abs(prev[0] - part[0][0]) + Math.abs(prev[1] - part[0][1]) !== 1) {
					return null;
				}
			}
			for (let k = 0; k < part.length; k += 1) {
				out.push(part[k]);
			}
		}
		return out;
	}

	/** 最长直线段长度，用来判断曲线是否「方正」（越大越像来回梳的条带） */
	function longestRun(path) {
		if (!path) {
			return Infinity;
		}
		let maxRun = 1;
		let run = 1;
		for (let i = 2; i < path.length; i += 1) {
			const dx1 = path[i - 1][0] - path[i - 2][0];
			const dy1 = path[i - 1][1] - path[i - 2][1];
			const dx2 = path[i][0] - path[i - 1][0];
			const dy2 = path[i][1] - path[i - 1][1];
			if (dx1 === dx2 && dy1 === dy2) {
				run += 1;
				if (run > maxRun) {
					maxRun = run;
				}
			} else {
				run = 1;
			}
		}
		return maxRun;
	}

	/* ------------------------------------------------------------------ *
	 * 构造一：经典四象限递归
	 * ------------------------------------------------------------------ */

	/**
	 * 填充矩形区域
	 *
	 * @param x0 - 起始列
	 * @param y0 - 起始行
	 * @param w - 列数
	 * @param h - 行数
	 * @param entry - 进入角点
	 * @param exit - 离开角点
	 * @returns 格点数组，失败返回 null
	 */
	function fill(x0, y0, w, h, entry, exit) {
		if (!validCorners(w, h, entry, exit)) {
			return null;
		}

		if (w === 1 && h === 1) {
			return [[x0, y0]];
		}

		if (w === 1) {
			const out = [];
			const fromBottom = entry === SW || entry === SE;
			for (let i = 0; i < h; i += 1) {
				out.push([x0, y0 + (fromBottom ? i : h - 1 - i)]);
			}
			return out;
		}

		if (h === 1) {
			const out = [];
			const fromLeft = entry === SW || entry === NW;
			for (let i = 0; i < w; i += 1) {
				out.push([x0 + (fromLeft ? i : w - 1 - i), y0]);
			}
			return out;
		}

		// 长宽比达到 2:1 时先沿长边二分，子块才会是正方形，
		// 整体看起来才是「方方正正」的经典希尔伯特结构；否则四象限会切出长条。
		const ratio = Math.max(w, h) / Math.min(w, h);
		if (ratio >= 2) {
			const bis = tryBisect(x0, y0, w, h, entry, exit);
			if (bis) {
				return bis;
			}
		}

		const quad = tryQuadrants(x0, y0, w, h, entry, exit);
		if (quad) {
			return quad;
		}

		return tryBisect(x0, y0, w, h, entry, exit);
	}

	/** 四象限递归（经典希尔伯特结构） */
	function tryQuadrants(x0, y0, w, h, entry, exit) {
		const wA = Math.ceil(w / 2);
		const hA = Math.ceil(h / 2);
		return quadrants(x0, y0, w, h, entry, exit, wA, hA);
	}

	/** 按给定的分割位置做四象限递归 */
	function quadrants(x0, y0, w, h, entry, exit, wA, hA) {
		const wB = w - wA;
		const hB = h - hA;
		if (wB < 1 || hB < 1) {
			return null;
		}

		const qe = quadrantOf(entry);
		const qx = quadrantOf(exit);
		const delta = (qx - qe + 4) % 4;
		let step;
		if (delta === 3) {
			step = 1;
		} else if (delta === 1) {
			step = 3;
		} else {
			return null;
		}

		const order = [qe, (qe + step) % 4, (qe + 2 * step) % 4, (qe + 3 * step) % 4];
		const rects = [
			[x0, y0, wA, hA],
			[x0 + wA, y0, wB, hA],
			[x0 + wA, y0 + hA, wB, hB],
			[x0, y0 + hA, wA, hB],
		];

		for (let bits = 0; bits < 8; bits += 1) {
			const corners = [[entry, exit]];
			let ok = true;
			for (let i = 0; i < 3 && ok; i += 1) {
				const pair = junction(order[i], order[i + 1], (bits >> i) & 1);
				corners[i][1] = pair[0];
				corners.push([pair[1], exit]);
			}
			for (let i = 0; i < 4 && ok; i += 1) {
				const rect = rects[order[i]];
				if (!validCorners(rect[2], rect[3], corners[i][0], corners[i][1])) {
					ok = false;
				}
			}
			if (!ok) {
				continue;
			}

			const orderedRects = [];
			const orderedCorners = [];
			for (let i = 0; i < 4; i += 1) {
				orderedRects.push(rects[order[i]]);
				orderedCorners.push(corners[i]);
			}

			const parts = [];
			for (let i = 0; i < 4; i += 1) {
				const rect = orderedRects[i];
				parts.push(fill(rect[0], rect[1], rect[2], rect[3], orderedCorners[i][0], orderedCorners[i][1]));
			}
			const merged = concatPaths(parts, orderedRects, orderedCorners);
			if (merged) {
				return merged;
			}
		}

		return null;
	}

	/** 二分递归（四象限不可用时的回退） */
	function tryBisect(x0, y0, w, h, entry, exit) {
		const axes = w >= h ? ['w', 'h'] : ['h', 'w'];
		for (let i = 0; i < axes.length; i += 1) {
			const result = bisect(x0, y0, w, h, entry, exit, axes[i]);
			if (result) {
				return result;
			}
		}
		return null;
	}

	function bisect(x0, y0, w, h, entry, exit, axis) {
		if (axis === 'w') {
			if (w < 2) {
				return null;
			}
			const w1 = Math.floor(w / 2);
			const w2 = w - w1;
			const entryLeft = entry === SW || entry === NW;
			const rects = entryLeft
				? [
						[x0, y0, w1, h],
						[x0 + w1, y0, w2, h],
					]
				: [
						[x0 + w1, y0, w2, h],
						[x0, y0, w1, h],
					];
			const options = entryLeft
				? [
						[SE, SW],
						[NE, NW],
					]
				: [
						[SW, SE],
						[NW, NE],
					];
			return mergeHalves(rects, options, entry, exit);
		}

		if (h < 2) {
			return null;
		}
		const h1 = Math.floor(h / 2);
		const h2 = h - h1;
		const entryBottom = entry === SW || entry === SE;
		const rects = entryBottom
			? [
					[x0, y0, w, h1],
					[x0, y0 + h1, w, h2],
				]
			: [
					[x0, y0 + h1, w, h2],
					[x0, y0, w, h1],
				];
		const options = entryBottom
			? [
					[NW, SW],
					[NE, SE],
				]
			: [
					[SW, NW],
					[SE, NE],
				];
		return mergeHalves(rects, options, entry, exit);
	}

	function mergeHalves(rects, options, entry, exit) {
		for (let i = 0; i < options.length; i += 1) {
			const corners = [
				[entry, options[i][0]],
				[options[i][1], exit],
			];
			if (!validCorners(rects[0][2], rects[0][3], corners[0][0], corners[0][1])) {
				continue;
			}
			if (!validCorners(rects[1][2], rects[1][3], corners[1][0], corners[1][1])) {
				continue;
			}
			const parts = [
				fill(rects[0][0], rects[0][1], rects[0][2], rects[0][3], corners[0][0], corners[0][1]),
				fill(rects[1][0], rects[1][1], rects[1][2], rects[1][3], corners[1][0], corners[1][1]),
			];
			const merged = concatPaths(parts, rects, corners);
			if (merged) {
				return merged;
			}
		}
		return null;
	}

	/* ------------------------------------------------------------------ *
	 * 构造二：带评分搜索的递归
	 *
	 * 经典递归在奇偶尺寸上只能退化为二分，容易切出整行整列的梳状长条。
	 * 这里把「分割位置 × 连接方式」都作为候选，按最长直线段打分择优，
	 * 并用 (宽, 高, 进入角, 离开角) 做记忆化，避免重复计算。
	 * ------------------------------------------------------------------ */

	/** 记忆化缓存：键为「宽|高|进入角|离开角」，值为相对起点的路径 */
	const solveCache = new Map();

	function solveKey(w, h, entry, exit) {
		return w + '|' + h + '|' + entry + '|' + exit;
	}

	function mergeParts(parts) {
		const out = [];
		for (let i = 0; i < parts.length; i += 1) {
			const part = parts[i];
			if (!part || part.length === 0) {
				return null;
			}
			if (out.length > 0) {
				const prev = out[out.length - 1];
				if (Math.abs(prev[0] - part[0][0]) + Math.abs(prev[1] - part[0][1]) !== 1) {
					return null;
				}
			}
			for (let k = 0; k < part.length; k += 1) {
				out.push(part[k]);
			}
		}
		return out;
	}

	/** 按 (w, h, entry, exit) 求最优路径，坐标相对 (0, 0) */
	function solve(w, h, entry, exit) {
		if (!validCorners(w, h, entry, exit)) {
			return null;
		}
		const key = solveKey(w, h, entry, exit);
		if (solveCache.has(key)) {
			return solveCache.get(key);
		}
		// 先占位，防止异常情况下死循环
		solveCache.set(key, null);

		let result = null;
		if (w === 1 && h === 1) {
			result = [[0, 0]];
		} else if (w === 1) {
			const out = [];
			const fromBottom = entry === SW || entry === SE;
			for (let i = 0; i < h; i += 1) {
				out.push([0, fromBottom ? i : h - 1 - i]);
			}
			result = out;
		} else if (h === 1) {
			const out = [];
			const fromLeft = entry === SW || entry === NW;
			for (let i = 0; i < w; i += 1) {
				out.push([fromLeft ? i : w - 1 - i, 0]);
			}
			result = out;
		} else {
			let best = null;
			let bestRun = Infinity;
			const cols = uniqueNumbers(Math.floor(w / 2), Math.ceil(w / 2));
			const rows = uniqueNumbers(Math.floor(h / 2), Math.ceil(h / 2));

			for (let a = 0; a < cols.length && bestRun > 2; a += 1) {
				for (let b = 0; b < rows.length && bestRun > 2; b += 1) {
					const wA = cols[a];
					const hA = rows[b];
					if (wA < 1 || hA < 1 || w - wA < 1 || h - hA < 1) {
						continue;
					}
					for (let bits = 0; bits < 8; bits += 1) {
						const candidate = solveQuadrants(w, h, entry, exit, wA, hA, bits);
						const run = longestRun(candidate);
						if (run < bestRun) {
							bestRun = run;
							best = candidate;
						}
					}
				}
			}

			// 兜底：任何尺寸都能用二分铺满
			if (!best) {
				best = solveBisect(w, h, entry, exit);
			}
			result = best;
		}

		solveCache.set(key, result);
		return result;
	}

	function uniqueNumbers(a, b) {
		return a === b ? [a] : [a, b];
	}

	/** 四象限候选（分割位置可选） */
	function solveQuadrants(w, h, entry, exit, wA, hA, bits) {
		const qe = quadrantOf(entry);
		const qx = quadrantOf(exit);
		const delta = (qx - qe + 4) % 4;
		let step;
		if (delta === 3) {
			step = 1;
		} else if (delta === 1) {
			step = 3;
		} else {
			return null;
		}

		const order = [qe, (qe + step) % 4, (qe + 2 * step) % 4, (qe + 3 * step) % 4];
		const rects = [
			[0, 0, wA, hA],
			[wA, 0, w - wA, hA],
			[wA, hA, w - wA, h - hA],
			[0, hA, wA, h - hA],
		];
		const corners = [[entry, exit]];
		for (let i = 0; i < 3; i += 1) {
			const pair = junction(order[i], order[i + 1], (bits >> i) & 1);
			corners[i][1] = pair[0];
			corners.push([pair[1], exit]);
		}

		const parts = [];
		for (let i = 0; i < 4; i += 1) {
			const rect = rects[order[i]];
			const sub = solve(rect[2], rect[3], corners[i][0], corners[i][1]);
			if (!sub) {
				return null;
			}
			parts.push(shiftPath(sub, rect[0], rect[1]));
		}
		return mergeParts(parts);
	}

	/** 二分候选 */
	function solveBisect(w, h, entry, exit) {
		let best = null;
		let bestRun = Infinity;
		const axes = w >= h ? ['w', 'h'] : ['h', 'w'];
		for (let i = 0; i < axes.length; i += 1) {
			const axis = axes[i];
			const cuts = uniqueNumbers(Math.floor((axis === 'w' ? w : h) / 2), Math.ceil((axis === 'w' ? w : h) / 2));
			for (let c = 0; c < cuts.length; c += 1) {
				const cut = cuts[c];
				if (cut < 1 || cut >= (axis === 'w' ? w : h)) {
					continue;
				}
				const candidate = solveHalves(w, h, entry, exit, axis, cut);
				const run = longestRun(candidate);
				if (run < bestRun) {
					bestRun = run;
					best = candidate;
				}
			}
		}
		return best;
	}

	function solveHalves(w, h, entry, exit, axis, cut) {
		let rects;
		let options;
		if (axis === 'w') {
			const entryLeft = entry === SW || entry === NW;
			rects = entryLeft
				? [
						[0, 0, cut, h],
						[cut, 0, w - cut, h],
					]
				: [
						[cut, 0, w - cut, h],
						[0, 0, cut, h],
					];
			options = entryLeft
				? [
						[SE, SW],
						[NE, NW],
					]
				: [
						[SW, SE],
						[NW, NE],
					];
		} else {
			const entryBottom = entry === SW || entry === SE;
			rects = entryBottom
				? [
						[0, 0, w, cut],
						[0, cut, w, h - cut],
					]
				: [
						[0, cut, w, h - cut],
						[0, 0, w, cut],
					];
			options = entryBottom
				? [
						[NW, SW],
						[NE, SE],
					]
				: [
						[SW, NW],
						[SE, NE],
					];
		}

		let best = null;
		let bestRun = Infinity;
		for (let i = 0; i < options.length; i += 1) {
			const corners = [
				[entry, options[i][0]],
				[options[i][1], exit],
			];
			const first = rects[0];
			const second = rects[1];
			if (!validCorners(first[2], first[3], corners[0][0], corners[0][1])) {
				continue;
			}
			if (!validCorners(second[2], second[3], corners[1][0], corners[1][1])) {
				continue;
			}
			const partA = solve(first[2], first[3], corners[0][0], corners[0][1]);
			const partB = solve(second[2], second[3], corners[1][0], corners[1][1]);
			if (!partA || !partB) {
				continue;
			}
			const merged = mergeParts([shiftPath(partA, first[0], first[1]), shiftPath(partB, second[0], second[1])]);
			if (!merged) {
				continue;
			}
			const run = longestRun(merged);
			if (run < bestRun) {
				bestRun = run;
				best = merged;
			}
		}
		return best;
	}

	/** 交换横纵坐标（宽高互换后的走法） */
	function transposePath(path) {
		if (!path) {
			return null;
		}
		const out = [];
		for (let i = 0; i < path.length; i += 1) {
			out.push([path[i][1], path[i][0]]);
		}
		return out;
	}

	function shiftPath(path, dx, dy) {
		const out = [];
		for (let i = 0; i < path.length; i += 1) {
			out.push([path[i][0] + dx, path[i][1] + dy]);
		}
		return out;
	}

	/* ------------------------------------------------------------------ *
	 * 对外接口
	 * ------------------------------------------------------------------ */

	/**
	 * 生成矩形网格上的希尔伯特曲线
	 *
	 * 终点角点有多个合法选择，不同选择会得到差异极大的形状（有的会退化成梳状长条），
	 * 这里把两套构造的候选全部试一遍，取「最长直线段最短」的那个。
	 *
	 * @param options - 参数对象
	 * @param options.cols - 列数
	 * @param options.rows - 行数
	 * @param options.mode - 起始方向模式，0 ~ 3
	 * @returns 格点序列
	 */
	function buildPath(options) {
		const cols = Math.max(1, Math.round(Number(options.cols) || 1));
		const rows = Math.max(1, Math.round(Number(options.rows) || 1));
		const mode = ((Math.round(Number(options.mode) || 0) % 4) + 4) % 4;

		if (solveCache.size > 20000) {
			solveCache.clear();
		}

		let base = null;
		let bestScore = Infinity;
		const consider = function (candidate) {
			if (!candidate) {
				return;
			}
			const score = longestRun(candidate);
			if (score < bestScore) {
				bestScore = score;
				base = candidate;
			}
		};
		for (const exit of [SE, NE, NW, SW]) {
			if (!validCorners(cols, rows, SW, exit)) {
				continue;
			}
			consider(fill(0, 0, cols, rows, SW, exit));
			consider(solve(cols, rows, SW, exit));
			consider(solveBisect(cols, rows, SW, exit));
		}
		// 横竖两个方向各试一次：同样的面积，宽高互换后的走法往往差别很大
		if (cols !== rows) {
			for (const exit of [SE, NE, NW, SW]) {
				if (!validCorners(rows, cols, SW, exit)) {
					continue;
				}
				consider(transposePath(fill(0, 0, rows, cols, SW, exit)));
				consider(transposePath(solve(rows, cols, SW, exit)));
			}
		}
		if (!base) {
			throw new Error('无法生成 ' + cols + 'x' + rows + ' 的曲线');
		}

		return base.map(function (point) {
			let x = point[0];
			let y = point[1];
			if (mode === 1) {
				x = cols - 1 - x;
			} else if (mode === 2) {
				y = rows - 1 - y;
			} else if (mode === 3) {
				x = cols - 1 - x;
				y = rows - 1 - y;
			}
			return [x, y];
		});
	}

	/** 按给定方式翻转一个点（用于绘制底层镜像图形） */
	function transform(x, y, mirror, box) {
		if (!mirror || mirror === 'none' || !box) {
			return [x, y];
		}
		let mx = x;
		let my = y;
		if (mirror === 'h' || mirror === 'both') {
			mx = 2 * box.x0 + box.width - x;
		}
		if (mirror === 'v' || mirror === 'both') {
			my = 2 * box.y0 + box.height - y;
		}
		return [mx, my];
	}

	global.HilbertCore = {
		NET_NAME: NET_NAME,
		LAYER_TOP: LAYER_TOP,
		LAYER_BOTTOM: LAYER_BOTTOM,
		buildPath: buildPath,
		transform: transform,
	};
})(typeof globalThis !== 'undefined' ? globalThis : this);
