
var isStop = false;
var totalList = [];
var newList = [];

function load(details){
	var url = details.url;
	var arr = totalList.filter(function(v, i){
		return v.url == url;
	});
	if(arr.length <= 0){
		totalList.push(details);
		newList.push(details);
	}
	return true;
}


var requestController = {
	begin: function(){
		chrome.webRequest.onCompleted.addListener(load,{urls: ["<all_urls>"]},["responseHeaders"]);
	}
	,stop: function(){
		chrome.webRequest.onCompleted.removeListener(load);
	}
}

var getOnceClearCommon = false;
chrome.extension.onMessage.addListener(function(request, sender, sendResponse){
	if(request.msg == "clear"){
		totalList = [];
		newList = [];
		isStop = false;
		requestController.stop();
		requestController.begin();
		getOnceClearCommon = true;
	}
	// 当接收到一次 clear 命令后，就应该无视一次stop命令
	// 保证资源的下载
	if(request.msg == "stop" && !getOnceClearCommon){
		totalList = [];
		newList = [];
		getOnceClearCommon = false;
		requestController.stop();
	}
	if (request.msg == "getResourceList") {
		setTimeout(function(){
			// 每次都清空列表
			newList = [];
			chrome.extension.sendMessage({
				msg: "returnResourceList"
				,data: totalList
			});
		}, 20);
	}else if(request.msg == "getNewerResourceList") {
		setTimeout(function(){
			// 每次都清空列表
			chrome.extension.sendMessage({
				msg: "returnNewerResourceList"
				,data: newList.slice(0)
			});
			newList = [];
		}, 20);
	}
});