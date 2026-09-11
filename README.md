# oheco-packages

oheco 的软件目录、索引规范和 GitHub Pages 下载站。目录包含 `oheco 0.3.0`、`go 1.27.1-ohos.1` 及 5 个 `ohos-sdk-*` 组件，
目标平台为 `ohos-arm64`。软件包本身发布到对应适配仓库的 GitHub Releases。

移植维护者为 [Guo Wei (@kdada)](https://github.com/kdada)。

## 文件

- `packages/<name>.json`：人工维护的包描述，也是唯一版本信息来源。
- `schema/`：JSON Schema 2020-12 结构规范。
- `site/`：无需服务端或前端构建工具的下载网站。
- `scripts/build.sh`：调用 `oheco` 仓库内共享的 Go 校验器，生成 `public/`。
- `.github/workflows/pages.yml`：检查软件包后部署静态站，PR 仅检查而不部署。

## 包规范 v2

包级字段：`schema_version`、`name`、`description`、`upstream`、`repository`、
`maintainers`、`license`、`latest`、`versions`，以及可选的 `notes`。
`repository` 必须属于 `https://github.com/oheco/`；负责人可以是 GitHub 用户或维护团队。
`latest` 按平台显式指向某个版本，客户端不自行推断版本大小。

版本包含 `version`、可选 `upstream_version` 和按平台映射的 `artifacts`。
同一个 `(包名, 版本, 平台)` 对应不可变产物，适配修订请分配新版本，例如
`1.0.0-ohos.1`，并保留 `upstream_version: "1.0.0"`。

每个产物包含以下必填字段：

| 字段 | 含义 |
| --- | --- |
| `url` | HTTPS 软件包地址；仅本地调试允许 loopback HTTP |
| `sha256` | 最终压缩包的 64 位小写 SHA-256 |
| `size` | 压缩包字节数，最大 8 GiB |
| `format` | `tar.gz` 或 `zip` |
| `strip_components` | 解压时明确去掉的前缀目录层数，0–8 |
| `binaries` | 命令名到解压后相对路径的映射；无命令包使用 `{}` |
| `launchers`（可选） | 需要由启动器以原名执行的命令列表，必须引用 `binaries` 中的名称 |

SDK 等新功能包使用 `schema_version: 2`；原有 v1 包仍可收录。

名字和版本不允许 `/`、`@`、空格及路径跳转。包内路径不得越界。
允许有效的包内相对软链接，不允许硬链接、特殊文件、重复条目或悬空软链接。
ZIP 额外验证 CRC，拒绝加密条目；保留目录 `.oo-launchers/` 仅由客户端生成启动器。
软件包内的可执行文件必须带执行权限；其他内容可包含 `lib/`、`share/`、源码、许可证等。
第一版不执行安装钩子，不自动求解跨包依赖；随包依赖应使用可重定位的目录布局。

例如压缩包带有 `example/` 根目录时，使用 `strip_components: 1`，
`binaries` 可为 `{"example":"bin/example"}`。
oheco 自举包固定使用 `strip_components: 0` 和 `{"oo":"bin/oo"}`。

校验器除结构校验外，还验证版本唯一性、latest 引用、平台、URL、命令全局归属和
二进制路径。安装端再次执行同样的语义校验。不同包在同一平台不能提供同名命令。
软件包的上游许可证及随包第三方许可应保留在发行包中。

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
  index/v2/index.json          # 完整索引
  index/v1/index.json          # 旧客户端升级入口
  schema/{package,index}.schema.json
  schema/v1/{package,index}.schema.json
  .nojekyll
```

页面和客户端读取同一份索引。安装脚本由 oheco 模板和该包当前平台的 latest 产物生成，
内嵌固定版本、URL、SHA-256 和包描述，避免脚本与索引漂移。

## 发布顺序

1. 在 `oheco/oheco` 发布 `v0.3.0`，上传已签名的 `oheco-0.3.0-ohos-arm64.tar.gz`
   及其 `.sha256`。Pages 索引生成器继续固定为兼容的 `v0.2.0`。
2. 确认包描述中的移植负责人、项目地址、大小及哈希与发行文件一致。
3. 在 `oheco-packages` 的 Settings → Pages 中选择 GitHub Actions。
4. 推送包描述；工作流验证下载后部署。首次尚未上传 Release 时，远端产物校验失败是预期结果。

正式地址为 `https://oheco.github.io/oheco-packages/`。本地生成成功不代表 GitHub 已发布。
新增版本先发布并验证二进制，再提交索引；已发布版本的下载地址和产物不得被原地替换。

## Go 原生工具链

`go` 收录 [Go 1.27.1 的 OHOS ARM64 适配发行版](https://github.com/oheco/go/releases/tag/go1.27.1-ohos.1)，
包版本为 `1.27.1-ohos.1`，对应上游版本 `1.27.1`。`go version` 显示
`go1.27.1 ohos/arm64`。旧的 `1.27.1` 包已撤下，新适配版使用独立版本号和发行地址。

```sh
oo update
oo install go
go version
```

也可指定 `oo install go@1.27.1-ohos.1`。归档中的工具已签名，包内根目录为 `go/`，
安装时使用 `strip_components: 1`，提供 `go` 和 `gofmt` 命令，并保留完整工具链布局。
使用 v1 包规范，兼容现有客户端。

构建需要 PATH 中的 `binary-sign-tool`（可通过 `oo install ohos-sdk-toolchains` 安装）；
cgo 另需 OHOS SDK 的 Clang、LLD、llvm-ar 和 sysroot（`oo install ohos-sdk-native`）。
将 `TMPDIR` 指向当前应用的私有可写目录；如配置过旧工具链的 `GOROOT`，先执行
`unset GOROOT`，让 Go 自动定位安装目录。客户端不会自动安装这些依赖。

已验证原生构建、运行、测试、cgo 等功能。完整支持范围和宿主限制见
[适配说明](https://github.com/oheco/go/blob/go1.27.1-ohos.1/misc/harmony/README.md)及
[验证记录](https://github.com/oheco/go/blob/go1.27.1-ohos.1/misc/harmony/VALIDATION.md)。

## OpenHarmony SDK

5 个组件分别维护一个 `packages/ohos-sdk-<component>.json`，当前版本统一为
`26.0.0.35-Beta`，直接引用 `oheco/ohos-sdk` Release 的原始 ZIP，不重新打包。
每个压缩包带有对应组件的根目录，故均设置 `strip_components: 1`；版本目录内保留完整组件布局。

- `native`：LLVM 15.0.4、sysroot、CMake/CTest/CPack 3.28.2、Ninja 1.13.2。
- `toolchains`：`lib/binary-sign-tool`、`lib/hap-sign-tool`、`lib/ohos_packing_tool` 和目录根部的工具。
- `ets` / `js`：暂按资源包安装，内置工具尚未验证在主目录中可执行，不创建命令链接。
- `previewer`：当前只有元数据和 NOTICE，`binaries: {}`，不提供预览器程序。

各 SDK 命令使用生成的启动器，避免添加 `@版本` 后改变 LLD 等程序的模式。
当前不支持 LLDB，描述文件不声明任何 lldb 命令。各包均保留原始 NOTICE 中的许可证。

Pages 使用 v0.2.0 索引生成器。完整 v2 索引供新版 oo 和网站使用，v1 索引只包含
`schema_version: 1` 的包，包含最新 oheco 版本。oheco 自举包持续使用 v1 / tar.gz，
旧版客户端通过 `oo update && oo install oheco` 升级后，再次执行 `oo update` 获取 SDK。

native 的原始 ZIP 包含 8 对仅大小写不同且内容不同的头文件。oo 解压默认保留全小写
文件名对应的原始内容，舍弃对应的大写变体，不受 ZIP 条目顺序影响，以兼容鸿蒙主目录
文件系统。需要大写变体中定义的代码仍需另行适配；Release ZIP 及校验值保持不变。
该规则由客户端统一实现，描述文件无需添加排除列表。
