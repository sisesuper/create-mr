import * as vscode from 'vscode';
import * as child_process from 'child_process';
import { promisify } from 'util';
import { API, GitExtension, Repository, GitInfo, Commit } from './type';
import { log } from './utils';

const execAsync = promisify(child_process.exec);

class GitExtensionWrap implements vscode.Disposable {
    apiListeners: vscode.Disposable[] = [];
    private enablementListener?: vscode.Disposable;
    private repositoryCountChangedEmitter = new vscode.EventEmitter<void>();
    // private wrappedRepositories: WrappedRepository[] = [];

    onRepositoryCountChanged = this.repositoryCountChangedEmitter.event;

    private gitApi?: API;
    private gitExtension?: GitExtension;
    private repo?: Repository;
    public repos: Repository[] = [];
    public repoPath?: string;

    // private async onDidChangeGitExtensionEnablement(enabled: boolean) {
    //     if (enabled) {
    //       this.register();
    //       await this.addRepositories(this.gitApi?.repositories ?? []);
    //     } else {
    //     //   this.wrappedRepositories = [];
    //       this.repositoryCountChangedEmitter.fire();
    //       this.disposeApiListeners();
    //     }
    // }

    async init(repoPath: string, cb: (paths: string[]) => void) {
        try {
            this.gitExtension = vscode.extensions.getExtension<GitExtension>('vscode.git')?.exports;
            if (!this.gitExtension) {
              log('Could not get Git Extension');
              return;
            }
            this.gitApi = this.gitExtension?.getAPI(1);

            // 有子模块
            this.repos = this.gitApi.repositories;
            const paths = this.repos
                .sort((a, b) => a.rootUri.path.length - b.rootUri.path.length)
                .map(item => {
                    return item.rootUri.path;
                });
            cb(paths);

            this.repoPath = repoPath;
            console.log(this.gitApi.repositories);
            // this.enablementListener = this.gitExtension.onDidChangeEnablement(
            //   this.onDidChangeGitExtensionEnablement,
            //   this,
            // );
            // await this.onDidChangeGitExtensionEnablement(this.gitExtension.enabled);
          } catch (error) {
            // handleError(error);
        }
    }

    getInfo() {
        return new Promise<GitInfo>(async (res, rej) => {
            this.repo = this.repos?.find(r => {
                return r.rootUri.path === this.repoPath;
            });
            if (!this.repo && this.repos.length) {
                this.repo = this.repos[0];
                this.repoPath = this.repo.rootUri.path;
            }
            if (!this.repo) {
                return rej();
            }

            const head = this.repo.state.HEAD;
            const url = this.repo.state.remotes[0]?.fetchUrl?.replace(/\.git(\/)?$/, '');
            const match = url?.match(/\/([^\/.]+)$/);

            const branches = await this.repo?.getBranches({remote: true});
            res({
                branches,
                currentBranchName: head?.name || 'master',
                projectName: match ? match[1] : '',
                url,
            });
        });
    }

    /**
     * 获取两个分支之间的差异提交
     * @param sourceBranch 源分支名称
     * @param targetBranch 目标分支名称
     * @returns 差异提交列表（从源分支到目标分支之间的提交），按时间排序，最早的在前
     */
    async getDiffCommits(sourceBranch: string, targetBranch: string) {
        if (!this.repo || !sourceBranch || !targetBranch) {
            return [];
        }

        try {
            // 获取两个分支的共同祖先
            let mergeBase: string;
            try {
                mergeBase = await this.repo.getMergeBase(sourceBranch, targetBranch);
            } catch (error) {
                // 如果获取共同祖先失败，可能两个分支没有共同历史
                return [];
            }
            
            // 获取源分支和目标分支的提交历史
            // 由于vscode git API的log方法获取的是当前HEAD的提交，我们需要通过其他方式
            // 方法：使用git命令获取指定分支的提交历史
            
            // 获取源分支从共同祖先到源分支的所有提交
            // 使用git命令：git log mergeBase..sourceBranch --oneline
            // 但vscode git API不直接支持，我们需要通过Repository的方法
            
            // 临时方案：获取当前HEAD的提交，然后通过commit hash获取详细信息
            // 或者：使用git命令通过exec执行
            
            // 使用git命令获取差异提交
            // 获取仓库路径
            const repoPath = this.repo.rootUri.fsPath;
            
            // 执行git log命令获取差异提交
            // git log targetBranch..sourceBranch --pretty=format:"%H|%s|%ad" --date=iso --reverse
            // 使用--reverse确保最早的提交在前
            const command = `git log ${targetBranch}..${sourceBranch} --pretty=format:"%H|%s|%ad" --date=iso --reverse`;
            
            try {
                const { stdout, stderr } = await execAsync(command, { 
                    cwd: repoPath,
                    maxBuffer: 10 * 1024 * 1024 // 10MB buffer
                });
                
                if (stderr && !stderr.includes('warning')) {
                    // 如果stderr包含错误（非警告），返回空数组
                    return [];
                }
                
                // 解析输出
                const commits: Commit[] = [];
                const lines = stdout.trim().split('\n').filter(line => line.trim());
                
                for (const line of lines) {
                    const parts = line.split('|');
                    if (parts.length >= 3) {
                        const hash = parts[0];
                        const message = parts.slice(1, -1).join('|'); // 处理message中可能包含|的情况
                        const dateStr = parts[parts.length - 1];
                        
                        const commitDate = new Date(dateStr);
                        commits.push({
                            hash,
                            message,
                            parents: [],
                            commitDate,
                            authorDate: commitDate
                        });
                    }
                }
                
                // 已经按时间排序（--reverse参数），返回第一个（时间最早的）
                return commits;
            } catch (execError: any) {
                // 如果命令执行失败，返回空数组
                if (execError.code !== 128) { // 128是git命令的标准错误码，表示无差异
                    log(`Git command failed: ${execError.message}`);
                }
                return [];
            }
        } catch (error) {
            log(`Failed to get diff commits: ${error}`);
            return [];
        }
    }

    dispose() {}
}

export default GitExtensionWrap;
