// 新页面打开，就应该停止计时了..
chrome.extension.sendMessage({
	msg: "stop"
});