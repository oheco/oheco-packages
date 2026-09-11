# oheco-packages

oheco 的软件目录、索引规范和 GitHub Pages 下载站。首批收录 `oheco` 和 `go`，
目标平台为 `ohos-arm64`。软件包本身发布到对应适配仓库的 GitHub Releases。

`oheco` 和 `go` 的移植维护者均为 [Guo Wei (@kdada)](https://github.com/kdada)。

## 文件

- `packages/<name>.json`：人工维护的包描述，也是唯一版本信息来源。
- `schema/`：JSON Schema 2020-12 结构规范。
- `site/`：无需服务端或前端构建工具的下载网站。
- `scripts/build.sh`：调用 `oheco` 仓库内共享的 Go 校验器，生成 `public/`。
- `.github/workflows/pages.yml`：检查软件包后部署静态站，PR 仅检查而不部署。

## 包规范 v1

包级字段：`schema_version`、`name`、`description`、`upstream`、`repository`、
`maintainers`、`license`、`latest`、`versions`，以及可选的 `notes`。
`repository` 必须属于 `https://github.com/oheco/`；负责人可以是 GitHub 用户或维护团队。
`latest` 按平台显式指向某个版本，客户端不自行推断版本大小。

版本包含 `version`、可选 `upstream_version` 和按平台映射的 `artifacts`。
同一个 `(包名, 版本, 平台)` 对应不可变产物，适配修订请分配新版本，例如
`1.27.1-ohos.1`，并保留 `upstream_version: "1.27.1"`。

每个产物包含以下必填字段：

| 字段 | 含义 |
| --- | --- |
| `url` | HTTPS 软件包地址；仅本地调试允许 loopback HTTP |
| `sha256` | 最终压缩包的 64 位小写 SHA-256 |
| `size` | 压缩包字节数，最大 8 GiB |
| `format` | 第一版固定 `tar.gz` |
| `strip_components` | 解压时明确去掉的前缀目录层数，0–8 |
| `binaries` | 命令名到解压后相对路径的映射 |

名字和版本不允许 `/`、`@`、空格及路径跳转。包内路径不得越界。
允许有效的包内相对软链接，不允许硬链接、特殊文件、重复条目或悬空软链接。
软件包内的可执行文件必须带执行权限；其他内容可包含 `lib/`、`share/`、源码、许可证等。
第一版不执行安装钩子，不自动求解跨包依赖；随包依赖应使用可重定位的目录布局。

例如 Go 的压缩包根目录是 `go/`，因此 `strip_components: 1`，
`binaries` 为 `{"go":"bin/go","gofmt":"bin/gofmt"}`。
oheco 自举包固定使用 `strip_components: 0` 和 `{"oo":"bin/oo"}`。

校验器除结构校验外，还验证版本唯一性、latest 引用、平台、URL、命令全局归属和
二进制路径。安装端再次执行同样的语义校验。不同包在同一平台不能提供同名命令。
Go 的上游 BSD 许可证及随包第三方许可保留在发行包中。

## 本地生成

相邻检出 `oheco`，开发环境安装 Go 1.23 或更新版本：

```sh
sh scripts/build.sh
python3 -m http.server 8080 --directory public --bind 127.0.0.1
```

用 `OHECO_SOURCE` 指定 oheco 源码路径，用 `GO` 指定开发环境 Go 的绝对路径，
用 `OHECO_SITE_OUTPUT` 指定输出目录。发布前必须校验实际下载：

```sh
sh scripts/build.sh --verify-artifacts
```

`public/` 是生成目录，不提交到 Git。输出：

```text
public/
  index.html
  style.css
  app.js
  install.sh
  index/v1/index.json
  schema/{package,index}.schema.json
  .nojekyll
```

页面和客户端读取同一份索引。安装脚本由 oheco 模板和该包当前平台的 latest 产物生成，
内嵌固定版本、URL、SHA-256 和包描述，避免脚本与索引漂移。

## 首次发布顺序

1. 在 `oheco/oheco` 发布 `v0.1.0`，上传已签名的 `oheco-0.1.0-ohos-arm64.tar.gz`
   及其 `.sha256`。该标签也为索引生成器提供可复现版本。
2. 准备 `oheco/go` 适配源码仓库并发布 `v1.27.1`，上传
   `go1.27.1.ohos-arm64.tar.gz` 及其 `.sha256`。
3. 确认包描述中的移植负责人、项目地址、大小及哈希与发行文件一致。
4. 在 `oheco-packages` 的 Settings → Pages 中选择 GitHub Actions。
5. 推送包描述；工作流验证下载后部署。首次尚未上传 Release 时，远端产物校验失败是预期结果。

正式地址为 `https://oheco.github.io/oheco-packages/`。本地生成成功不代表 GitHub 已发布。
新增版本先发布并验证二进制，再提交索引；已发布版本的下载地址和产物不得被原地替换。
