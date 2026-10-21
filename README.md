# eext-hilbert-creator

嘉立创EDA & EasyEDA 专业版扩展 —— 希尔伯特曲线生成器

<a href="https://github.com/klxf/eext-hilbert-creator" target="_blank"><img src="https://img.shields.io/github/stars/klxf/eext-hilbert-creator" alt="GitHub Repo Stars" /></a>&nbsp;<a href="https://github.com/klxf/eext-hilbert-creator/issues" target="_blank"><img src="https://img.shields.io/github/issues/klxf/eext-hilbert-creator" alt="GitHub Issues" /></a>&nbsp;<a href="https://github.com/klxf/eext-hilbert-creator" target="_blank"><img src="https://img.shields.io/github/repo-size/klxf/eext-hilbert-creator" alt="GitHub Repo Size" /></a>&nbsp;<a href="https://choosealicense.com/licenses/unlicense/" target="_blank"><img src="https://img.shields.io/github/license/klxf/eext-hilbert-creator" alt="GitHub License" /></a>&nbsp;<img src="https://img.shields.io/badge/EasyEDA-%5E2.2.35-5588ff" alt="EasyEDA" />

![面板](docs/panel.png)

## 开始使用

这是一个 **嘉立创EDA** 或 **EasyEDA** 专业版的拓展，可以便捷地在 PCB 中绘制希尔伯特曲线并计算电阻值。

1. 下载本拓展，在 **嘉立创EDA** 或 **EasyEDA** 专业版中安装

2. 在 PCB 页面中，点击顶部菜单的 `希尔伯特` → `生成希尔伯特曲线...`，即可打开本扩展

3. 输入线宽、间距、起始点与区域宽高，即可自动生成曲线，并实时显示步距、网格、线长与电阻

    - **步距** = 线宽 + 间距；区域宽高决定列数与行数，矩形靠行列铺满，曲线不会被拉长
    - **双面错开**：底层整体偏移半个步距，正好落在顶层走线的空隙里
    - **过孔串联**：远端一个过孔把正反面接成一条回路，近端两层各引出一段接线端子
    - **电阻**：按铜厚（oz，直接填数字，默认 1 oz = 35 μm）与工作温度计算
    - **模式**：0/1/2/3 分别对应起点在矩形左下、右下、左上、右上
    - **布线层**：可选顶层、底层或双面（顶+底）

    ![双面错开](docs/dual-layer.png)

4. 使用“铜线阻值计算器”功能，可以便捷计算线长或线宽

## 功能说明

| 功能 | 说明 |
|---|---|
| 参数化布局 | 直接输入线宽、间距、区域宽高；步距 = 线宽 + 间距，横纵一致，格子恒为正方形 |
| 矩形区域 | 长宽比达到 2:1 时沿长边二分，并自动挑选最优终点角点，矩形区域也是方方正正的希尔伯特结构，不再出现梳状长条 |
| 双面错开 | 底层整体偏移半个步距，落在顶层走线的空隙里，正反面交替发热、温度更均匀 |
| 过孔串联 | 远端打一个过孔把正反面接成一条回路，近端两层的末端各引出一段线当接线端子 |
| 电阻模型 | 按铜厚（oz）与温度计算：R = ρ(T)·L/(w·t)，ρ₂₀ = 0.01724 Ω·mm²/m，α = 0.00393 /℃，并统一了阻值计算器的电阻率 |
| 实时信息 | 输入时实时显示步距、网格、区域实际尺寸、铜箔线长与电阻 |
| 绘制加速 | 合并同向连续线段（图元减少约 40%）+ 分批并发提交，不再逐段 await |

## 开发

```bash
npm install
npm run build   # 编译 dist/index.js 并打包 build/dist/*.eext
```

主要文件：

- `iframe/js/hilbert.js`：矩形网格上的希尔伯特曲线几何（纯计算，不依赖 EDA API）
- `iframe/js/main.js`：步距/网格计算、双面错开与过孔、分批绘制、电阻计算
- `iframe/index.html`：参数面板与交互

## 文言脚本

适用于 [吾有一术](https://github.com/klxf/eext-wenyan) 拓展的文言脚本：[绘希氏图](https://github.com/klxf/eext-hilbert-creator/blob/master/src/%E7%B9%AA%E5%B8%8C%E6%B0%8F%E5%9C%96.wy)

## 开源许可

本项目使用 [The Unlicense](https://choosealicense.com/licenses/unlicense/) 开源许可协议
