// import { info } from '../utils';
(function() {
    const vscode = acquireVsCodeApi();

    const query = e => document.querySelector(e);
    const queryAll = e => document.querySelectorAll(e);
    const postMsg = (type, data) => vscode.postMessage({ type, data });

    const oldState = vscode.getState();

    // todo
    setTimeout(() => {
        postMsg('init', oldState.repoPath);
    }, 500);

    // repo tab
    query('#repo-list').onclick = function(e) {
        const target = e.target;
        const repoPath = target.dataset.path;
        if (repoPath) {
            target.parentElement.childNodes.forEach(item => {
                item.classList?.remove('active');
            });
            target.classList.add('active');
            vscode.setState({ ...oldState, repoPath });
            postMsg('repoChange', repoPath);
        }
    };
    function updateRepoTab(paths) {
        state = vscode.getState();
        let repoPath = state.repoPath;
        const dom = query('#repo-list');
        if (dom && paths.length > 1) {
            if (!repoPath || !paths.includes(repoPath)) {
                repoPath = paths[0];
            }
            vscode.setState({ ...oldState, repoPath });
            dom.innerHTML = `
                <div class="mrt-repo">
                    ${paths.map(item => {
                        const name = item.split('/').reverse()[0];
                        return `<div 
                            class="mrt-repo-name ${repoPath === item ? 'active' : ''}"
                            data-path="${item}"
                        >${name}</div>`;
                    }).join('')}
                </div>
            `;
        }
    }

    // submit MR
    query('#submit').onclick = function() {
        const formItems = queryAll('.form');
        const data = {};
        formItems.forEach(item => {
            const name = item.getAttribute('name');
            data[name] = item.value;
            if(name === 'reviewer_id' && item.value){
                data.reviewer_ids = [Number(item.value)];
            }
        });

        const checkbox = queryAll('.checkbox');
        checkbox.forEach(item => {
            const name = item.getAttribute('name');
            data[name] = item.checked;
        });

        postMsg('submitMR', data);
        storageData(data);
    };

    const assigneeNameDom = query('.mrt-assignee-name');
    const reviewerNameDom = query('.mrt-reviewer-name');
    // search input
    const searchInpDomAssignee = query('#keywordInp-assignee');
    const searchInpDomReviewer = query('#keywordInp-reviewer');
    // user assignee list
    const userWrapAssigneeDom = query('.mrt-user-select.assignee');
    // user reviewer list
    const userWrapReviewerDom = query('.mrt-user-select.reviewer');
    let timer;

    // 点击输入框显示用户列表
    function userWrapDomClick (type) {
        return function(){
            type === 'assignee' ? userWrapAssigneeDom.classList.add('show') : userWrapReviewerDom.classList.add('show');
            clearTimeout(timer);
            setTimeout(() => {
                type === 'assignee' ? searchInpDomAssignee.focus() : searchInpDomReviewer.focus();
                query(`.${type} .mrt-user-item.hover`)?.classList?.remove('hover');
                // 监听上下按键
                document.onkeydown = function(e) {
                    const active = query(`.${type} .mrt-user-item.active`);
                    const firstItem = query(`.${type} .mrt-user-item`);
                    const hoverItem = query(`.${type} .mrt-user-item.hover`) || active;
                    if (e.key === 'ArrowDown') {
                        const next = !hoverItem ? firstItem : hoverItem.nextElementSibling;
                        if (next) {
                            hoverItem?.classList.remove('hover');
                            next.classList.add('hover');
                            next.scrollIntoView(true);
                        }
                    } else if (e.key === 'ArrowUp') {
                        const prev = !hoverItem ? firstItem : hoverItem.previousElementSibling;
                        if (prev) {
                            hoverItem?.classList.remove('hover');
                            prev.classList.add('hover');
                            prev.scrollIntoView(true);
                        }
                    } else if (e.key === 'Enter') {
                        if (!hoverItem) {
                            return;
                        }
                        hoverItem.click();
                        type === 'assignee' ? searchInpDomAssignee.blur() : searchInpDomReviewer.blur();
                    }
                };
            }, 300);
        };
    }
    assigneeNameDom.onclick =  userWrapDomClick('assignee');
    reviewerNameDom.onclick = userWrapDomClick('reviewer');

    // 失焦隐藏用户列表
    function userWrapDomBlur (type) {
        return function(){
            timer = setTimeout(() => {
                type === 'assignee' ? userWrapAssigneeDom.classList.remove('show') : userWrapReviewerDom.classList.remove('show');
                // 取消监听上下按键
                document.onkeydown = null;
            }, 100);
        };
    }
    searchInpDomAssignee.onblur = userWrapDomBlur('assignee');
    searchInpDomReviewer.onblur = userWrapDomBlur('reviewer');

    searchInpDomAssignee.oninput = debounce(function(e) {
        postMsg('searchUser', e.target.value);
    }, 500);
    searchInpDomReviewer.oninput = debounce(function(e) {
        postMsg('searchReviewer', e.target.value);
    }, 500);

    // select assignee
    const userListAssigneeDom = query('.assignee .mrt-user-list');
    const userListReviewerDom = query('.reviewer .mrt-user-list');

    let selectedAssignee = oldState?.selectedAssignee;
    setCurrentAssignee(selectedAssignee || {});
    // 设置缓存用户数据
    let selectedReviewer = oldState?.selectedReviewer;
    setCurrentReviewer(selectedReviewer || {});

    // 点击用户列表选中用户
    function userListDomCLick(e) {
        const li = e.target.tagName === 'LI' ? e.target : e.target.parentNode;
        if (!li || li.tagName !== 'LI') {
            return;
        };
        Array.prototype.slice.call(li?.parentNode?.children || [])
            .filter(el => el.tagName === 'LI' && el !== li)
            .forEach(item => item.classList.remove('active'));
        li?.classList.toggle('active');
        const type = li.classList.contains('assignee-item') ? 'assignee' : 'reviewer';
        const data = li.dataset;
        if (type === 'assignee') {
            setCurrentAssignee(selectedAssignee?.id === data?.id ? {} : data);
        } else {
            setCurrentReviewer(selectedReviewer?.id === data?.id ? {} : data);
        }
    }
    userListAssigneeDom.onclick = userListDomCLick;
    userListReviewerDom.onclick = userListDomCLick;

    // 删除选中用户
    function delUsers(type){
        return () => {
            type === 'assignee' ? setCurrentAssignee({}) : setCurrentReviewer({});
            query(`.${type} .mrt-user-item.active`)?.classList?.remove('active');
        };
    }
    query('.del-assignee').onclick = delUsers('assignee');
    query('.del-reviewer').onclick = delUsers('reviewer');

    let currentBranchName = '';
    // remote branches
    let branches = [];
    // 推断出的目标分支名称
    let inferredTargetBranch = '';
    
    // 存储用户列表，用于匹配代码审查人
    let usersList = [];
    
    // 待处理的代码审查人名称（当需要搜索用户时使用）
    let pendingReviewerName = '';

    window.addEventListener('message', event => {
        const msg = event.data;
        switch (msg.type) {
            case 'viewTips':
                setTipsVisible(msg.data);
                break;
            case 'branches':
                branches = msg.data;
                updateBranches(branches);
                // 如果推断的目标分支已经收到，更新目标分支（确保使用package.json规则）
                if (inferredTargetBranch) {
                    setTargetBranch();
                }
                break;
            case 'currentBranch':
                currentBranchName = msg.data;
                // 如果分支列表已经加载，更新source branch
                if (branches.length > 0) {
                    setSourceBranch();
                }
                break;
            case 'users':
                usersList = msg.data; // 保存用户列表
                updateUsers(msg.data, 'assignee');
                // 如果有待处理的代码审查人，尝试匹配
                if (pendingReviewerName && msg.data.length > 0) {
                    matchAndSetReviewer(pendingReviewerName, msg.data);
                    pendingReviewerName = ''; // 清除待处理标记
                }
                break;
            case 'reviewers':
                // 保存用户列表（reviewers和users是同一个列表）
                if (usersList.length === 0) {
                    usersList = msg.data;
                }
                updateUsers(msg.data, 'reviewer');
                // 如果有待处理的代码审查人，尝试匹配
                if (pendingReviewerName && msg.data.length > 0) {
                    matchAndSetReviewer(pendingReviewerName, msg.data);
                    pendingReviewerName = ''; // 清除待处理标记
                }
                break;
            case 'updateRepoTab':
                updateRepoTab(msg.data);
                break;
            case 'targetBranch':
                inferredTargetBranch = msg.data;
                // 如果分支列表已经加载，更新目标分支
                // 确保初始化时使用package.json的规则
                if (branches.length > 0) {
                    setTargetBranch();
                    // 请求获取差异提交的commit message（初始化后）
                    const sourceBranch = query('.mrt-source-branch')?.value;
                    const targetBranch = query('.mrt-target-branch')?.value;
                    if (sourceBranch && targetBranch) {
                        postMsg('getDiffCommitMessage', {
                            sourceBranch,
                            targetBranch
                        });
                    }
                }
                break;
            case 'diffCommitMessage':
                // 接收到差异提交的commit message
                const commitMessage = msg.data;
                // 按照规则填充到表单中（规则之后再说，先留个接口）
                if (commitMessage) {
                    fillFormWithCommitMessage(commitMessage);
                }
                break;
        }
    });

    // debounce
    function debounce(fn, delay) {
        let timer;
        return function() {
            let _this = this;
            const opt = arguments;
            clearTimeout(timer);
            timer = setTimeout(function () {
                fn.apply(_this, opt);
            }, delay);
        };
    }

    // 设置分支下拉框选项及默认值
    function updateBranches() {
        const select = queryAll('.branches-select');
        select.forEach(item => {
            item.innerHTML = branches.map(({ name }) => {
                return `<option value="${name}">${name}</option>`;
            }).join('');
        });
        setSourceBranch();
        // 注意：setTargetBranch 会在收到 targetBranch 消息时调用，确保使用package.json规则
        // 如果还没有收到 targetBranch 消息，先使用默认值
        setTargetBranch();
        
        // 监听源分支和目标分支变化事件
        const sourceBranchSelect = query('.mrt-source-branch');
        const targetBranchSelect = query('.mrt-target-branch');
        
        // 获取差异提交的commit message的函数
        const requestDiffCommitMessage = () => {
            const sourceBranch = sourceBranchSelect?.value;
            const targetBranch = targetBranchSelect?.value;
            if (sourceBranch && targetBranch) {
                postMsg('getDiffCommitMessage', {
                    sourceBranch,
                    targetBranch
                });
            }
        };
        
        if (sourceBranchSelect) {
            // 移除旧的事件监听器（如果有的话）
            sourceBranchSelect.onchange = null;
            // 添加新的事件监听器
            sourceBranchSelect.onchange = function() {
                const selectedSourceBranch = sourceBranchSelect.value;
                if (selectedSourceBranch) {
                    // 切换分支时，先清空表单
                    clearFormFields();
                    // 根据源分支名称推断目标分支
                    inferTargetBranchFromSource(selectedSourceBranch);
                    // 请求获取差异提交的commit message
                    requestDiffCommitMessage();
                }
            };
        }
        
        if (targetBranchSelect) {
            // 移除旧的事件监听器（如果有的话）
            targetBranchSelect.onchange = null;
            // 添加新的事件监听器
            targetBranchSelect.onchange = function() {
                // 切换分支时，先清空表单
                clearFormFields();
                // 请求获取差异提交的commit message
                requestDiffCommitMessage();
            };
        }
    }
    function setSourceBranch() {
        const dom = query('.mrt-source-branch');
        let value = '';
        if (branches.find(item => item.name === currentBranchName)) {
            value = currentBranchName;
        }
        dom.value = value;

        setTitle();
    }
    // 根据源分支名称推断目标分支
    function inferTargetBranchFromSource(sourceBranchName) {
        if (!sourceBranchName) {
            return;
        }
        
        // 如果切换的源分支是当前分支，使用package.json的逻辑（由后端处理）
        // 这里不做格式推断，因为后端的inferTargetBranch已经处理了当前分支
        if (sourceBranchName === currentBranchName) {
            // 使用后端推断的目标分支（inferredTargetBranch）
            if (inferredTargetBranch) {
                const targetBranch = branches.find(({ name }) => name === inferredTargetBranch);
                if (targetBranch) {
                    const dom = query('.mrt-target-branch');
                    if (dom) {
                        dom.value = inferredTargetBranch;
                    }
                }
            }
            return;
        }
        
        // 如果切换的源分支不是当前分支，使用分支名称格式推断
        let targetBranchName = '';
        
        // 匹配 V2.16.12-P1-xxx-xxx 格式（包含-P数字-）
        const p1Pattern = /^V(\d+\.\d+\.\d+)-P\d+-(.+)$/;
        const p1Match = sourceBranchName.match(p1Pattern);
        if (p1Match) {
            // 提取版本号部分，如 V2.16.12-P1
            const versionWithP = sourceBranchName.match(/^V(\d+\.\d+\.\d+)-P\d+/);
            if (versionWithP) {
                const versionPart = versionWithP[0]; // 如 "V2.16.12-P1"
                targetBranchName = `${versionPart}-develop`;
            }
        } else {
            // 匹配 V2.16.12-xxxx-xxx 格式（不包含-P数字-）
            const normalPattern = /^V(\d+\.\d+\.\d+)-(.+)$/;
            const normalMatch = sourceBranchName.match(normalPattern);
            if (normalMatch) {
                // 提取版本号部分，如 V2.16.12
                const versionMatch = sourceBranchName.match(/^V(\d+\.\d+\.\d+)/);
                if (versionMatch) {
                    const versionPart = versionMatch[0]; // 如 "V2.16.12"
                    targetBranchName = `${versionPart}-develop`;
                }
            }
        }
        
        // 如果推断出目标分支，检查是否存在于分支列表中
        if (targetBranchName) {
            const targetBranch = branches.find(({ name }) => name === targetBranchName);
            if (targetBranch) {
                // 如果目标分支存在，设置为目标分支
                const dom = query('.mrt-target-branch');
                if (dom) {
                    dom.value = targetBranchName;
                }
            }
        }
    }

    function setTargetBranch() {
        let value = '';
        // 优先使用推断出的目标分支（基于package.json，如果存在且 branches 列表中也有该分支）
        if (inferredTargetBranch) {
            const inferredBranch = branches.find(({ name }) => name === inferredTargetBranch);
            if (inferredBranch) {
                value = inferredTargetBranch;
            }
        }
        
        // 如果推断出的目标分支不存在，使用原有逻辑
        if (!value) {
            if (oldState && oldState.targetBranch && branches.find(({ name }) => name === oldState.targetBranch)) {
                value = oldState.targetBranch;
            } else {
                const item = branches.find(({ name }) => ['master', 'dev'].includes(name));
                value = item?.name;
            }
        }
        
        // 如果还是没有值，使用第一个分支
        if (!value) {
            value = branches[0]?.name;
        }
        
        const dom = query('.mrt-target-branch');
        if (dom) {
            dom.value = value;
        }
    }

    function updateUsers(users = [], type = 'assignee') {
        const currentId = type === 'assignee' ? selectedAssignee?.id : selectedReviewer?.id;
        const list = users.map(({ name, username, id }) => {
            return `<li class="mrt-user-item ${type}-item ${currentId==id ? 'active' : ''}" data-id="${id}" data-name="${name}">
                <span class="name">${name}</span>
                <span class="username">@${username}</span>
            </li>`;
        }).join('');

        if(type === 'assignee') {
            userListAssigneeDom.innerHTML = list;
        } else {
            userListReviewerDom.innerHTML = list;
        }
        const emptyDom = query(`.${type} .empty`);
        if (users.length === 0) {
            emptyDom.classList.add('show');
        } else {
            emptyDom.classList.remove('show');
        }
        // 默认选中第一个
        // query(`.${type} .mrt-user-item[data-id='${}']`)?.classList?.add('active');
    }

    function setTitle() {
        const dom = query('.mrt-title');
        if (dom.value) {
            return;
        }
        dom.value = currentBranchName;
    }

    /**
     * 清空表单的title、description、指派人、审核人
     */
    function clearFormFields() {
        const titleDom = query('.mrt-title');
        const descriptionDom = query('.mrt-description');
        if (titleDom) {
            titleDom.value = '';
        }
        if (descriptionDom) {
            descriptionDom.value = '';
        }
        // 清空指派人
        setCurrentAssignee({});
        // 清空审核人
        setCurrentReviewer({});
    }

    /**
     * 格式化commit message，在每个字段之间添加换行符
     * @param commitMessage 原始的commit message
     * @returns 格式化后的commit message（每个字段一行）
     */
    function formatCommitMessageWithLineBreaks(commitMessage) {
        if (!commitMessage) {
            return '';
        }
        
        // 如果已经包含换行符，保持原样（可能已经是格式化好的）
        if (commitMessage.includes('\n')) {
            return commitMessage;
        }
        
        // 如果commit message中没有换行符，说明是单行格式，需要格式化
        // 在每个字段标签前添加换行（除了第一个字段）
        let formatted = commitMessage;
        formatted = formatted.replace(/(\s+)(影响分析：)/, '\n$2');
        formatted = formatted.replace(/(\s+)(是否自测：)/, '\n$2');
        formatted = formatted.replace(/(\s+)(自测内容：)/, '\n$2');
        formatted = formatted.replace(/(\s+)(测试建议：)/, '\n$2');
        formatted = formatted.replace(/(\s+)(代码审查：)/, '\n$2');
        formatted = formatted.replace(/(\s+)(NOTE：)/, '\n$2');
        formatted = formatted.replace(/(\s+)(项目编号：)/, '\n$2');
        formatted = formatted.replace(/(\s+)(功能模块：)/, '\n$2');
        
        return formatted;
    }

    /**
     * 在用户列表中匹配并设置代码审查人
     * @param reviewerName 代码审查人名称
     * @param userList 用户列表
     */
    function matchAndSetReviewer(reviewerName, userList) {
        if (!reviewerName || !userList || userList.length === 0) {
            return;
        }
        
        const matchedUser = userList.find(user => {
            const name = user.name || '';
            const username = user.username || '';
            // 支持精确匹配姓名或用户名
            return name === reviewerName || username === reviewerName || 
                   name.includes(reviewerName) || username.includes(reviewerName);
        });
        
        if (matchedUser) {
            // 设置为Assignee和Reviewer
            setCurrentAssignee({ id: matchedUser.id, name: matchedUser.name });
            setCurrentReviewer({ id: matchedUser.id, name: matchedUser.name });
        }
    }

    /**
     * 根据commit message填充表单
     * @param commitMessage 差异提交的commit message（第一个，时间最早的）
     * 规则：
     * 1. 提取"修改描述："后面的内容作为Title
     * 2. 把全部信息作为Description
     * 3. 提取"代码审查："后面的人作为Assignee（指派人）和Reviewer（审核人）
     */
    function fillFormWithCommitMessage(commitMessage) {
        // 在生成表单内容之前，先清空表单的title、description、指派人、审核人
        clearFormFields();
        
        if (!commitMessage) {
            return;
        }
        
        // 获取DOM引用（在清空后重新获取）
        const titleDom = query('.mrt-title');
        const descriptionDom = query('.mrt-description');
        
        // 解析commit message
        // 格式示例：
        // 修改描述：[fix]修改测试(bug#12) 影响分析：修改测试(bug#12) 是否自测：是 自测内容：修改测试(bug#12) 测试建议：无 代码审查：颜豪 NOTE：无 项目编号：无 功能模块：;
        
        // 1. 提取"修改描述："后面的内容作为Title（直到下一个字段或字符串结尾）
        let title = '';
        const modifyDescMatch = commitMessage.match(/修改描述：(.+?)(?=\s*影响分析：|\s*代码审查：|\s*NOTE：|$)/);
        if (modifyDescMatch) {
            title = modifyDescMatch[1].trim();
        }
        
        // 2. 把全部信息作为Description，并且每个字段之间添加换行符
        // 将每个字段之间添加换行，使格式更清晰
        const description = formatCommitMessageWithLineBreaks(commitMessage);
        
        // 3. 提取"代码审查："后面的人作为Assignee和Reviewer（直到下一个字段或字符串结尾）
        let reviewerName = '';
        const codeReviewMatch = commitMessage.match(/代码审查：(.+?)(?=\s*NOTE：|\s*项目编号：|\s*功能模块：|$)/);
        if (codeReviewMatch) {
            reviewerName = codeReviewMatch[1].trim();
        }
        
        // 填充Title和Description（之前已经获取了DOM引用）
        if (titleDom && title) {
            titleDom.value = title;
        }
        if (descriptionDom && description) {
            descriptionDom.value = description;
        }
        
        // 查找并设置Assignee和Reviewer
        if (reviewerName) {
            // 先在本地用户列表中查找匹配的用户（支持姓名或用户名匹配）
            let matchedUser = null;
            if (usersList.length > 0) {
                matchedUser = usersList.find(user => {
                    const name = user.name || '';
                    const username = user.username || '';
                    // 支持精确匹配姓名或用户名
                    return name === reviewerName || username === reviewerName || 
                           name.includes(reviewerName) || username.includes(reviewerName);
                });
            }
            
            // 如果在本地列表中找不到，通过API搜索用户
            if (!matchedUser) {
                // 请求后端搜索用户
                postMsg('searchUser', reviewerName);
                // 设置一个标记，当收到用户搜索结果时，再次尝试匹配
                // 由于是异步的，这里先保存reviewerName，等收到搜索结果后再处理
                pendingReviewerName = reviewerName;
            } else {
                // 如果在本地找到了，直接设置
                matchAndSetReviewer(reviewerName, [matchedUser]);
            }
        }
    }

    function storageData(formData) {
        vscode.setState({
            targetBranch: formData.target_branch,
            selectedAssignee,
            selectedReviewer,
        });
    }

    function setCurrentAssignee({ id, name }) {
        query('.mrt-assignee-id').value = id || '';
        assigneeNameDom.innerHTML = name || '';
        selectedAssignee = { id, name };
        if(name){
            query(`.del-assignee`).classList.remove('hidden');
        }else{
            query(`.del-assignee`).classList.add('hidden');
        }
    }

    function setCurrentReviewer({ id, name }) {
        query('.mrt-reviewer-id').value = id || '';
        reviewerNameDom.innerHTML = name || '';
        selectedReviewer = { id, name };
        if(name){
            query(`.del-reviewer`).classList.remove('hidden');
        }else{
            query(`.del-reviewer`).classList.add('hidden');
        }
    }

    function setTipsVisible(visible) {
        const method = visible ? 'add' : 'remove';
        const wrapDom = query('.mrt-wrap');
        wrapDom.classList.remove('hidden');
        wrapDom.classList[method]('show-tips');
    }

    // 打开 setting
    query('.setting-btn').onclick = () => {
        postMsg('setting');
    };
})();
