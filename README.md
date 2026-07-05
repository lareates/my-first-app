# Aetheris · 随行空间

可在车机与电脑上打开的多场景氛围网页，采用 Stitch 设计的 Aetheris 视觉语言。

## 部署到 GitHub Pages（公网访问）

### 1. 在 GitHub 创建仓库

1. 打开 [github.com/new](https://github.com/new)
2. 仓库名填 `my-first-app`（或你喜欢的名字）
3. 选 **Public**，**不要**勾选 "Add a README"
4. 点击 **Create repository**

### 2. 推送本地代码

把下面命令里的 `你的用户名` 换成你的 GitHub 用户名：

```bash
cd ~/Desktop/my-first-app
git remote add origin https://github.com/你的用户名/my-first-app.git
git push -u origin main
```

### 3. 开启 GitHub Pages

1. 进入仓库 → **Settings** → 左侧 **Pages**
2. **Source** 选 **Deploy from a branch**
3. **Branch** 选 `main`，文件夹选 `/ (root)`
4. 点 **Save**

约 1–2 分钟后访问：

```
https://你的用户名.github.io/my-first-app/
```

车机、手机用浏览器打开这个 HTTPS 链接即可（定位与音频需授权）。

## 场景

### 车内打盹（睡眠 / 冥想 / 呼吸）
- Stitch Aetheris 沉浸 UI：呼吸环、曼陀罗视觉、底部 Horizon 导航
- **睡眠**：棕噪声 + 深度低音 + Delta 双耳节拍
- **冥想**：雨声/风声/钢琴 + 432Hz + Alpha 节拍
- **呼吸**：432Hz 垫音 + 呼吸同步气流声 + Theta 节拍

### 户外露营（星空 / 地形 / 方位）
- 星轨流星、Flip 海拔、3D 指南针
- 子模式环境音：虫鸣夜风 / 高地风声 / 方位低频

### 充电等人
- Aetheris 玻璃 Bento、Lo-Fi 混音台、颂钵提醒
- Horizon 跳转：计时 / 电台 / 备忘
