# site-spider

爬取整站的利器

## config

项目根路径新建一个 `config.js` 文件，文件内容使用以下配置模板：

```javascript
module.exports = {
  userAgent: "", // 使用 headless 打开网页使用的 userAgent
  root: "./all-sites", //本地保存的地址
  siteRoot: "http://www.baidu.com/", //需要爬取的网站的根路径
  entryURL: ["index.html"], //需要爬取的网页入口
  cookies: [] // 可以使用chrome 插件 EditThisCookie 直接导出
};
```

可以根据自己的需要修改配置内容

## TODO

- [ ] 对于静态网站不使用 headless 加载，直接使用 http get
