# oheco-packages

oheco 的软件目录、索引规范和 GitHub Pages 下载站。目录收录 oheco 包管理器、Go 原生工具链、Python、Node.js、Git、tmux 及
5 个 `ohos-sdk-*` 组件，目标平台为 `ohos-arm64`。可用版本见
[软件下载站](https://oheco.github.io/oheco-packages/)，软件包本身发布到对应适配仓库的 GitHub Releases。

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
`oo` 不执行包内安装脚本，也不自动解析或安装跨包依赖；随包依赖应使用可重定位的目录布局。

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

## 发布流程

1. 在软件对应的适配仓库创建新版本的 GitHub Release，上传完成验证及所需签名的发行包
   和校验文件。
2. 新增或更新 `packages/<name>.json`，确认维护者、项目地址、版本、平台、下载地址、
   文件大小和 SHA-256 与已发布产物一致，并设置对应平台的 `latest`。
3. 执行 `sh scripts/build.sh --verify-artifacts`，确认包描述和实际下载产物通过校验。
4. 将包描述提交到 `main`（通过 PR 时先完成检查和合并）。工作流重新校验已发布产物后
   部署；产物校验失败时不部署，PR 检查本身也不部署。
5. 确认 Pages 工作流部署成功，并在[软件下载站](https://oheco.github.io/oheco-packages/)
   核对版本、下载链接和安装命令。

已发布版本的下载地址和产物不得被原地替换；适配修订应分配新版本。

### Pages 一次性配置

本仓库已使用 GitHub Actions 部署 Pages。新建同类仓库时，在 Settings → Pages 中将
Source 设为 GitHub Actions；后续发布由工作流完成，无需重复设置。

## Go 原生工具链

`go` 收录 [Go 1.27.1 的 OHOS ARM64 适配发行版](https://github.com/oheco/go/releases/tag/go1.27.1-ohos.1)，
包版本为 `1.27.1-ohos.1`，对应上游版本 `1.27.1`。`go version` 显示
`go1.27.1 ohos/arm64`。安装和版本切换使用包版本 `1.27.1-ohos.1`。

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

## Git 原生命令行工具

`git` 收录 [Git 2.55.0 的 OHOS ARM64 适配版](https://github.com/oheco/git/releases/tag/v2.55.0-ohos.2)，
包版本为 `2.55.0-ohos.2`，`git --version` 显示 `2.55.0.ohos.2`。

```sh
oo update
oo install git
git --version
```

支持基础版本管理、merge、rebase、stash 及 SSH、HTTP/HTTPS clone/push/fetch/pull。
HTTPS 静态集成 libcurl 8.22.0 和 Mbed TLS 3.6.7 LTS，默认使用鸿蒙系统 CA 校验证书链和
主机名；私有 CA 可用 Git 的 `http.sslCAInfo` 配置。当前采用 HTTP/1.1，未包含 HTTP/2/3
和旧式 WebDAV push。SSH 使用系统 `ssh` 及用户配置的密钥。发行包已签名，保留完整辅助
程序与模板目录，运行无需额外安装 curl/TLS 库或编译工具链。
本地克隆请使用 `--no-hardlinks`；共享目录若触发仓库所有者
检查，请确认路径后配置具体的 `safe.directory`，不要关闭所有仓库的检查。

使用 v2 包规范，为各命令生成启动器，保留原始命令名；也可使用
`git@2.55.0-ohos.2` 等带版本号的命令。旧版 `2.55.0-ohos.1` 保留下载，该版本仅支持本地和
SSH 传输。完整支持范围见
[适配说明](https://github.com/oheco/git/blob/v2.55.0-ohos.2/contrib/harmony/README.md)和
[测试记录](https://github.com/oheco/git/blob/v2.55.0-ohos.2/contrib/harmony/VALIDATION.md)。

## Git LFS 大文件管理

`git-lfs` 收录 [Git LFS 3.8.0 的 OHOS ARM64 原生版](https://github.com/oheco/git-lfs/releases/tag/v3.8.0-ohos.1)，
包版本为 `3.8.0-ohos.1`。这是独立的 `git-lfs` 程序，由 `git lfs` 调用。

```sh
oo update
oo install git
oo install git-lfs
git lfs version
# 在需要使用 LFS 的仓库中启用：
git lfs install --local
git lfs track '*.psd'
```

Git 必须另行安装并加入 PATH；`oo` 不会自动安装跨包依赖。通常先执行 `git lfs install`
启用用户过滤器，再克隆已有 LFS 仓库；包安装本身不会改动 Git 配置和 hooks。
程序静态集成 Go 网络/TLS 和依赖，无需运行时安装 Go、curl 或 OpenSSL。已签名，
支持整体迁移及 `git-lfs@3.8.0-ohos.1 version`。内置 Git LFS 帮助可用
`git lfs help track` 查看。

已通过鸿蒙原生 Go 单元测试、clean/smudge/filter-process、HTTPS 认证上传下载、
克隆自动还原、fsck、历史迁移，以及共享目录/含空格路径和本地复制回退验证。
HTTPS 默认校验系统 CA，私有 CA 可用 `http.sslCAInfo` 配置。SSH 使用系统 `ssh`；
真实 SSH/pure-SSH 和 Kerberos/NTLM 场景尚未验收。详见
[适配说明](https://github.com/oheco/git-lfs/blob/ohos/3.8.0/README.ohos.md)及
[验证记录](https://github.com/oheco/git-lfs/blob/ohos/3.8.0/ohos/VALIDATION.md)。

## tmux 终端复用器

`tmux` 收录 [tmux 3.5a 的鸿蒙原生适配版](https://github.com/oheco/tmux/releases/tag/3.5a-ohos.1)，
包版本为 `3.5a-ohos.1`。安装后可直接创建和恢复会话：

```sh
oo update
oo install tmux
tmux new-session -s work
```

Ctrl+B 后按 `%` 左右分屏、`"` 上下分屏、`c` 新建窗口、`d` 脱离会话。
重新连接使用 `tmux attach-session -t work`；也可使用版本命令 `tmux@3.5a-ohos.1`。

发行包已签名，静态集成 libevent 和 libtinfo，随包 terminfo 通过真实二进制位置自动查找，
无需另装这些库。默认 socket 位于应用私有目录
`/data/storage/el2/base/haps/entry/files/tmux-<UID>/`；其他终端环境可设置 `TMUX_TMPDIR`
或使用 `-S` 指定允许创建 Unix socket 的路径，共享目录及只读 `/tmp` 不适用。
包采用 v1 规范，`strip_components: 0`，保留 `bin/` 和 `share/` 的相对布局。

已验证分屏、窗口、中文输出、复制粘贴、缓冲区编辑、窗口缩放及 zshc 断线重连。
终端应用完全退出、系统休眠或后台回收后的保活尚未验证。详细范围见
[适配说明](https://github.com/oheco/tmux/blob/3.5a-ohos.1/README.ohos.md)和
[验收记录](https://github.com/oheco/tmux/blob/3.5a-ohos.1/ohos/validation.md)。

## Python 原生解释器

`python3` 收录 [CPython 3.14.7 的鸿蒙 ARM64 社区预发布版](https://github.com/oheco/cpython/releases/tag/v3.14.7-ohos.1)，
包版本为 `3.14.7-ohos.1`，包含 pip、venv、开发头文件和自动签名的扩展编译器入口。

```sh
oo update
oo install python3
python3 -VV
python3 -m venv .venv
. .venv/bin/activate
python -m pip --version
```

支持 SSL、ctypes、SQLite、压缩库、readline/curses、子进程和多进程。使用 v2 包规范，
命令启动器保留真实安装路径，支持 `python3@3.14.7-ohos.1`、`pip3@3.14.7-ohos.1`
及 `python3-config@3.14.7-ohos.1` 等版本入口。运行包已签名，解压时移除一层根目录。

原生扩展编译需 PATH 中的 OHOS SDK Clang 和 `binary-sign-tool`，客户端不会自动安装
这些工具。涉及 Unix socket 或严格 POSIX 权限时，将 `TMPDIR` 指向应用私有可写目录。
本版未包含 Tk、gdbm/ndbm 和可选 libuuid 扩展；Python `uuid` 和 `dbm.sqlite3` 可用。
通用 Linux/musllinux 二进制 wheel 不兼容。仅验证了 HarmonyOS PC ARM64 原生终端，
其他架构、系统版本和手机应用沙箱未验证。

已通过 15 项原生集成检查和 7 个上游测试文件（1,153 项测试，29 项跳过）。
运行包保留 GNU Readline GPLv3 等第三方许可证，完整对应源码随 Release 发布。
详见[构建说明](https://github.com/oheco/cpython/blob/v3.14.7-ohos.1/Tools/ohos/README.md)
及[验证记录](https://github.com/oheco/cpython/blob/v3.14.7-ohos.1/Tools/ohos/VALIDATION.md)。

## Node.js 原生运行时

`nodejs` 收录 [Node.js 24.21.0 的鸿蒙 ARM64 社区适配版](https://github.com/oheco/node/releases/tag/v24.21.0-ohos.1)，
包版本为 `24.21.0-ohos.1`，包含 npm/npx 11.19.0、Corepack 0.36.0、开发头文件及扩展签名入口。

```sh
oo update
oo install nodejs
node --version
npm --version
node -p "process.platform + '/' + process.arch"
```

平台标识为 `openharmony/arm64`。采用 v2 包规范，提供 `node@24.21.0-ohos.1`、
`npm@24.21.0-ohos.1`、`npx@24.21.0-ohos.1` 和 `corepack@24.21.0-ohos.1` 等版本入口。
运行包已签名，解压时移除一层根目录，支持含空格的安装路径。

保留 JIT、WebAssembly、完整 ICU、Inspector、SQLite 和 OpenSSL。纯 JavaScript 使用
无需 Python 或 SDK；原生扩展需另装 Python 3、OHOS SDK Clang、GNU Make 和
`binary-sign-tool`，并使用应用私有的可写 `TMPDIR`。只有随包 node-gyp 包含适配，独立
升级 npm 可能覆盖补丁。通用 Linux ARM64 预编译扩展不兼容，其他系统、架构和手机沙箱
尚未验证。

已通过 20 项原生集成检查、5 个上游 V8 回归文件和 57 个上游 Node 回归文件，并验证
npm 下载、npx、隔离全局安装/卸载、离线签名 N-API 扩展及运行包迁移。
完整对应源码随 Release 提供，详见[构建与使用说明](https://github.com/oheco/node/blob/v24.21.0-ohos.1/tools/ohos/README.md)
及[验证记录](https://github.com/oheco/node/blob/v24.21.0-ohos.1/tools/ohos/VALIDATION.md)。

## OpenHarmony SDK

5 个组件分别维护一个 `packages/ohos-sdk-<component>.json`，当前版本统一为
`26.0.0.35-Beta`，直接引用 `oheco/ohos-sdk` Release 的原始 ZIP，不重新打包。
每个压缩包带有对应组件的根目录，故均设置 `strip_components: 1`；版本目录内保留完整组件布局。

- `native`：LLVM 15.0.4、sysroot、CMake/CTest/CPack 3.28.2、Ninja 1.13.2。
- `toolchains`：`lib/binary-sign-tool`、`lib/hap-sign-tool`、`lib/ohos_packing_tool` 和目录根部的工具。
- `ets` / `js`：作为开发资源包提供，不创建编译器命令链接；完整应用构建需另行配置相应运行环境。
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
