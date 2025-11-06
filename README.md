# gitlab-mrt README

Gitlab Merge Request Helper fo VS Code.

![](src/assets/view.jpg)

## Features

+ Create an MR from VS Code

## Extension Settings

+ `create-mr.token`: Access token to use to connect to the Gitlab.com API. Create one by going to Profile Settings -> Access Tokens.

+ `create-mr.instanceUrl`: If you are using GitLab on a custom domain, you must add this to your user settings file.

VS Code settings:

![](src/assets/setting.jpg)

settings.json:

```json
{
    "create-mr.token": "xxx",
    "create-mr.instanceUrl": "https://git.xxx.com"
}
```
