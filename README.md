# 课堂答疑系统

一个轻量级的线上课堂问题收集工具。学生扫码即可匿名提问，老师集中管理回答。

## 功能特性

- **学生登录**：无需注册，输入名字即可进入课堂
- **问题可见性**：学生可选择"所有人可见"或"仅老师可见"
- **同学互助**：公开问题下，其他学生可以回答
- **管理员后台**：指定管理员（bnuxiewei@gmail.com）可查看所有问题并进行回答
- **权限控制**：学生可删除自己的问题，管理员可删除任意问题或回答
- **二维码分享**：管理员可一键生成课堂二维码供学生扫码进入
- **实时更新**：新问题自动刷新，无需手动刷新页面

## 技术栈

- **前端**：纯 HTML + CSS + JavaScript（无框架，轻量部署）
- **后端**：Firebase Authentication + Cloud Firestore
- **部署**：GitHub Pages

## 快速开始

### 第一步：创建 Firebase 项目

1. 访问 [Firebase Console](https://console.firebase.google.com/)，点击「创建项目」
2. 输入项目名称（如 `classroom-qa`），按向导完成创建
3. 项目创建后，点击 Web 图标（`</>`）注册 Web 应用
4. 记录下 Firebase 配置信息（`apiKey`、`authDomain`、`projectId` 等）

### 第二步：开启 Firebase 服务

**Authentication（认证）：**
1. 在左侧菜单进入「Authentication」→「登录方式」
2. 开启「匿名登录」（用于学生）
3. 开启「邮箱/密码登录」（用于管理员）
4. 在「用户」选项卡中，点击「添加用户」
   - 邮箱：`bnuxiewei@gmail.com`
   - 密码：**设置一个安全的密码**（记录好，这是管理员登录密码）

**Cloud Firestore（数据库）：**
1. 在左侧菜单进入「Cloud Firestore」→「创建数据库」
2. 选择「测试模式」开始（之后会替换为安全规则）
3. 选择数据库位置（选离你最近的区域）

### 第三步：配置项目

1. **打开 `js/firebase-config.js`**，替换为你的 Firebase 配置：

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",           // 你的 apiKey
  authDomain: "xxx.firebaseapp.com",  // 你的 authDomain
  projectId: "classroom-qa-xxx",      // 你的 projectId
  storageBucket: "xxx.appspot.com",   // 你的 storageBucket
  messagingSenderId: "123456789",     // 你的 senderId
  appId: "1:123456789:web:..."       // 你的 appId
};
```

2. **配置 Firestore 安全规则：**
   - 在 Firebase Console → Cloud Firestore → 「规则」选项卡
   - 复制 `firebase/firestore.rules` 中的内容并粘贴
   - 点击「发布」

3. **配置 Firestore 索引：**
   - 在 Firebase Console → Cloud Firestore → 「索引」选项卡
   - 手动创建以下复合索引（或参考 `firebase/firestore.indexes.json`）：

| 集合 | 字段1 | 排序 | 字段2 | 排序 | 字段3 | 排序 |
|------|-------|------|-------|------|-------|------|
| questions | visibility | ↑升序 | createdAt | ↓降序 | | |
| questions | authorId | ↑升序 | visibility | ↑升序 | createdAt | ↓降序 |
| answers | questionId | ↑升序 | createdAt | ↑升序 | | |
| questions | createdAt | ↓降序 | | | | |

   > 提示：运行应用后首次查询时，如果索引缺失，控制台会打印索引创建链接，点击即可自动创建。

### 第四步：部署到 GitHub Pages

1. 在 GitHub 上创建一个新仓库（如 `classroom-qa`）
2. 将本地文件推送到仓库：

```bash
git init
git add .
git commit -m "初始化课堂答疑系统"
git branch -M main
git remote add origin https://github.com/你的用户名/classroom-qa.git
git push -u origin main
```

3. 启用 GitHub Pages：
   - 仓库页面 → Settings → Pages
   - Source 选择「Deploy from a branch」
   - Branch 选择 `main`，文件夹选 `/ (root)`
   - 点击 Save
   - 等待几分钟，访问 `https://你的用户名.github.io/classroom-qa/`

4. **更新 Firebase 配置中的域名：**
   - 在 Firebase Console → Authentication → 设置 → 「已获授权的网域」
   - 添加你的 GitHub Pages 域名：`你的用户名.github.io`

## 使用指南

### 管理员登录
1. 打开页面，切换到「老师」标签
2. 邮箱已固定为 `bnuxiewei@gmail.com`
3. 输入之前在 Firebase 中设置的密码
4. 登录后可看到所有学生的问题（包括仅老师可见的）

### 学生加入
1. 管理员点击右上角「二维码」按钮
2. 投影或分享二维码给学生
3. 学生扫码后输入名字即可进入
4. 再次扫码可看到自己之前发布的问题

### 提问
1. 学生点击右下角「+」按钮
2. 输入问题内容
3. 选择「所有人可见」或「仅老师可见」
4. 提交

### 回答
- 学生可以在公开问题下回答
- 管理员可以在所有问题下回答

### 删除
- 学生可以删除自己的问题
- 管理员可以删除任何问题和任何回答

## 项目结构

```
classroom-qa/
├── index.html                 # 主页面
├── 404.html                   # GitHub Pages 重定向
├── css/
│   └── style.css              # 样式文件
├── js/
│   ├── firebase-config.js     # Firebase 配置（需修改）
│   └── app.js                 # 应用逻辑
├── firebase/
│   ├── firestore.rules        # 安全规则
│   └── firestore.indexes.json # 数据库索引
└── README.md
```

## 注意事项

- **数据安全**：Firestore 安全规则已限制用户只能访问自己有权限的数据
- **费用**：Firebase 免费套餐（Spark Plan）足够课堂使用，无需付费
- **隐私**：学生仅老师可见的问题，其他学生无法查看
- **密码**：管理员密码在 Firebase Console 中设置，如忘记可在「Authentication」中重置

## License

MIT
