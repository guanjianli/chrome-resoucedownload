// 全局的一些元素
var ulList = document.getElementById("scriptList");
var beginToListener = document.getElementById("beginToListener");
var loadCacheData = document.getElementById("loadCacheData");

var selectCountElem = document.getElementById("selectCount");
var downloadCountElem = document.getElementById("downloadCount");
var downloadFailCountElem = document.getElementById("downloadFailCount");
var selectCount = 0;


function addNewLinkItem(list) {
	for (var i = 0, max = list.length; i < max; i++) {
		var item = list[i];
		if (/^https?:\/\//.test(item.url)) {
			var li = createItem(item);
			ulList.appendChild(li);
		}
	}
}

// 接收获取列表资源的消息
chrome.extension.onMessage.addListener(function(details) {
	var list = details.data;
	if (details.msg == "returnResourceList") {
		if (list && list.length > 0) {
			count.innerHTML = list.length;
			addNewLinkItem(list);
		}
	} else if (details.msg == "returnNewerResourceList") {
		if (list && list.length > 0) {
			count.innerHTML = list.length + parseInt(count.innerHTML);
			addNewLinkItem(list);
		}
	}
});

var resourceTimer;
beginToListener.addEventListener("click", function(e) {
	ulList.innerHTML = "";
	count.innerHTML = "0";
	// 清空列表
	chrome.extension.sendMessage({
		msg: "clear"
	});
	chrome.tabs.executeScript({
		code: "location.reload()"
	});
	// 获取信息列表
	clearInterval(resourceTimer);
	resourceTimer = setInterval(function() {
		chrome.extension.sendMessage({
			msg: "getNewerResourceList"
		});
	}, 1000);
}, false);

// 加载缓存数据
loadCacheData.addEventListener("click", function(e) {
	ulList.innerHTML = "";
	count.innerHTML = "0";
	chrome.extension.sendMessage({
		msg: "getResourceList"
	});
});



var createId = 1;

function createItem(item) {
	var li = document.createElement("li");
	var id = item.type + createId++;
	var contentType = getContentType(item);
	var postfix = checkPostFixMap(item);

	var html = '<input data-postfix="' + postfix + '" data-id="' + id + '" data-ctype="' + contentType + '" data-src="' + item.url + '" data-type="' + item.type + '" data-link="link" type="checkbox" id="' + id + '"/><label for="' + id + '">' + item.url + '</label>';
	li.innerHTML = html;
	return li;
}


// Bold 对象管理
var blobBuilder, blob, BlobBuilder = this.WebKitBlobBuilder || this.MozBlobBuilder || this.BlobBuilder;

// 全局的zipWriter
var global_zipWriter;
var URL = this.webkitURL || this.mozURL || this.URL;

var g_resData = {}; //所有资源信息
var g_downResData = {}; //所有勾选的要下载的资源信息
var g_downResData_Flag = false; //是否下载完毕的标记
var g_fileName = [];

String.prototype.trim = function() {
	return this.replace(/^\s+/, "").replace(/\s+$/, "");
}

Number.prototype.fixZero = function() {
	if (this < 10) {
		return "0" + this;
	}
	return this;
}

function onerror(message) {
	console.error(message);
}

// 根据header信息，获取contet-type

function getContentType(item) {
	if (item && item.responseHeaders) {
		var arr = item.responseHeaders.filter(function(v, i) {
			if (v.name == "Content-Type") {
				return true;
			}
		});
		return arr.length > 0 ? arr[0].value : "";
	}
	return "";
}

// 检测后缀，并动态添加
var postfixMap = {};

function checkPostFixMap(item) {
	var postfix = "无后缀";

	var lastIndex = item.url.lastIndexOf("?");
	var fileName = item.url;
	if (lastIndex > 0) {
		fileName = fileName.slice(0, lastIndex);
	}
	lastIndex = fileName.lastIndexOf("/");
	if (lastIndex > 0) {
		fileName = fileName.slice(lastIndex + 1);
	}

	var arr = fileName.split(".");

	if (fileName != "" && arr.length > 1) {
		postfix = arr[arr.length - 1];
	}

	postfix = postfix.toLowerCase();

	// 更新后缀列表
	if (!postfixMap[postfix]) {
		updatePostCheckboxList(postfix);
		postfixMap[postfix] = 1;
	}

	return postfix;
}


// 后缀checkbox列表
var filterBox = document.getElementById("filterBox");

function updatePostCheckboxList(postfix) {
	var i = postfix;
	var html = '<input id="filter_' + i + '" type="checkbox" value="' + i + '" /><label for="filter_' + i + '">' + i + '</label>';
	var child = document.createElement("li");
	child.innerHTML = html;
	filterBox.appendChild(child);
}
updatePostCheckboxList("全选");

// 后缀点击后，应该进行选择
filterBox.addEventListener("click", function(e) {
	var target = e.target;
	if (e.tagName == "LI") {
		target = target.getElementsByTagName("INPUT")[0];
	}

	if (target.tagName == "INPUT") {
		var checkedCount = 0;
		var value = target.value;
		var isCheck = target.checked;
		var list = ulList.getElementsByTagName("input");
		for (var i = 0, max = list.length; i < max; i++) {
			var item = list[i];
			var attr = item.getAttribute("data-postfix");
			// 如果后缀一致，则进行选择
			if (attr == value || value == "全选") {
				item.checked = isCheck;
				initCheckBoxData(item);
			}
			if (item.checked) {
				checkedCount++;
			}
		}
		initCheckBoxData(target);

		// 修复一下提醒
		selectCount = checkedCount;
		selectCountElem.innerHTML = "已选择:" + selectCount;
	}


}, false);

// initialize checkBox data

function initCheckBoxData(checkbox) {
	var checked = checkbox.checked;
	var i = checkbox.getAttribute("data-id");

	if (checked) {
		var v = checkbox.getAttribute("data-src");
		var k = checkbox.getAttribute("data-type");
		var cType = checkbox.getAttribute("data-ctype"); // 从请求中获取的header信息，更加准确
		var link = checkbox.getAttribute("data-link");
		var type = "";
		if (cType) {
			type = cType;
		} else {
			if (k == "script") {
				type = "application/x-javascript";
			} else if (k == "stylesheet") {
				type = "text/css";
			} else if (k == "image") {
				type = "image/*";
			} else if (k == "main_frame") {
				type = "text/html";
			}
		}

		g_downResData[i] = [k, type, v, false, false, link]; //["script", "application/x-javascript","http://xxxx.js",null/blob, ispackaged,"link/data"];

		selectCount++;
	} else {
		delete g_downResData[i];
		selectCount--;
	}
	selectCountElem.innerHTML = "已选择:" + selectCount;
}

//select content
document.getElementById("scriptList").addEventListener("click", function(e) {
	var target = e.target;
	if (target.tagName == "LI") {
		target = target.getElementsByTagName("INPUT")[0];
	}

	if (target.tagName == "INPUT") {
		initCheckBoxData(target);
	}
}, false);

// 开始下载

function beginToDownLoad(downloadButton, event) {

	// 如果正在下载，就不处理
	if (downloadButton.download) {
		return false;
	}

	// 拿到所有的input信息
	var list = ulList.getElementsByTagName("input");
	var currentListIndex = 0; // 当前遍历到哪一个input

	var liList = ulList.getElementsByTagName("li");
	for (var i = 0, max = liList.length; i < max; i++) {
		liList[i].className = "";
	}
	// 重设当前元素索引，下载成功、失败的数目
	var downloadCount = downloadFailCount = 0
	downloadCountElem.innerHTML = "已下载:0";
	downloadFailCountElem.innerHTML = "下载失败:0";

	// 准备下载下一个文件

	function addZip(info) {
		// [0:类型, 1:下载类型, 2:链接或数据, 3:Blob对象, 4:是否下载完成, 5:下载的类型link或data]
		var filename = getProperName(info[0], info[2]);
		var path = getFilePath(info[2]);
		var blob = info[3];
		var linktype = info[5];

		if (linktype == "link") {
			global_zipWriter.add(path + filename, new zip.BlobReader(blob), function() {
				info[4] = true; // 表示下载完成
				downLoadNextFile();
			});
		} else {
			global_zipWriter.add(path + filename, new zip.Data64URIReader(blob), function() {
				info[4] = true; // 表示下载完成
				downLoadNextFile();
			});
		}
	}

	function downLoadNextFile() {
		for (var max = list.length; currentListIndex < max;) {
			var elem = list[currentListIndex];
			var parent = liList[currentListIndex];
			var id = elem.getAttribute("data-id");

			// [0:类型, 1:下载类型, 2:链接或数据, 3:Blob对象, 4:是否下载完成, 5:下载的类型link或data]
			var item = g_downResData[id];

			// 如果被选中，且没下载，就应该下载，并加入压缩包
			if (item && item[4] != true && elem.checked) {
				// 如果是link且并没有请求过blob资源的话
				if (item[5] == "link" && !item[3]) {
					// 给parent -> li 设置为 tdoing 背景
					parent.className = "tdoing";
					// 请求资源
					var request = new XMLHttpRequest();
					request.addEventListener("load", function() {
						currentListIndex++;
						if (request.status == 200) {
							var blob = new Blob([request.response], {
								type: item[1]
							});
							item[3] = blob;
							// 下载成功，改颜色
							parent.className = "tsuccess";
							// 设置一下下载的提醒
							downloadCount++;
							downloadCountElem.innerHTML = "已下载:" + downloadCount;
							// 进行压缩
							addZip(item);
						} else {
							// 应该标红，下载失败，不会加入压缩包
							downloadFailCount++;
							parent.className = "tfail";
							item[4] = false; // 表示没有下载
							downLoadNextFile();
						}
					}, false);
					request.open("GET", item[2]);
					request.responseType = 'blob';
					request.send();
				} else if (item[5] == "link" && item[3]) {
					currentListIndex++;
					// 如果已经请求过，则应该立刻进入下载
					// 下载成功，改颜色
					parent.className = "tsuccess";
					downloadCount++;
					// 进行压缩
					addZip(item);
				} else {
					currentListIndex++;
					// 如果是data类型，可以直接下载的了~
					item[3] = elem.getAttribute("data-src");
					// 下载成功，改颜色
					parent.className = "tsuccess";
					downloadCount++;
					// 进行压缩
					addZip(item);
				}

				// 设置一下下载的提醒
				downloadCountElem.innerHTML = "已下载:" + downloadCount;
				downloadFailCountElem.innerHTML = "下载失败:" + downloadFailCount;
				// 不再对下面进行遍历了
				break;
			} else {
				currentListIndex++;
			}
		}

		// 如果所有压缩包已添加
		// 关闭压缩包，并进行命名
		if (currentListIndex >= list.length) {
			global_zipWriter.close(function(blob) {
				var blobURL = URL.createObjectURL(blob);

				var clickEvent = document.createEvent("MouseEvent");
				clickEvent.initMouseEvent("click", true, true, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
				downloadButton.href = blobURL;
				downloadButton.download = getDownloadName();
				downloadButton.dispatchEvent(clickEvent);

				setTimeout(function() {
					URL.revokeObjectURL(blobURL);
					downloadButton.setAttribute("href", "javascript:;");
					downloadButton.download = "";
					resetPackageStatus();
					global_zipWriter = null;
					g_fileName = [];
				}, 1);

				zipWriter = null;
			});

		}

	}

	// 生成压缩工具
	zip.createWriter(new zip.BlobWriter(), function(zipWriter) {
		global_zipWriter = zipWriter;
		currentListIndex = 0;
		downLoadNextFile();
	}, onerror);

	// 先停止下载的检测


	event.preventDefault();

}

//获取尚未打包的文件

function resetPackageStatus() {
	for (var i in g_downResData) {
		g_downResData[i][4] = false;
	}
}

function getProperName(type, name) {
	var t = {
		"script": ".js",
		"stylesheet": ".css",
		"main_frame": ".html",
		"image": ".gif"
	};
	//get real name
	var url = name.split("?")[0];
	var pos = url.lastIndexOf("/");
	if (pos == -1) pos = url.lastIndexOf("\\")
	var filename = url.substr(pos + 1);

	if (filename.trim() == "") {
		filename = (new Date()).getTime() + "";
	}

	var tArr = filename.split(".");
	if (tArr.length == 1) {
		filename = filename + t[type];
	}
	
	// 这里应该加入路径检测，才正常的，不过，关我神马事呢，现在
	if (g_fileName.indexOf(filename) == -1) {
		g_fileName.push(filename);
	} else {
		// 如果有重复名字，给一个时间戳
		// 虽然现在理论上，比较少可能有相同名字
		filename = filename.replace(/([^.]+)\./, "$1_" + (new Date()).getTime() + ".");
		g_fileName.push(filename);
	}


	return filename;
}

function getFilePath(path) {
	var newPath = path ? path.replace(/(?:https?|ftp):\/\/(.+)/g, '$1') : "";
	var index = newPath.indexOf("?");
	if (index > 0) {
		newPath = newPath.slice(0, index);
	}
	var arr = newPath.split("/");
	var last = arr.length;
	// 如果“/”是最后的一个字母，就不要处理之~
	(newPath.lastIndexOf("/") + 1) == newPath.length ? true : arr[last - 1] = "";
	return arr.join("/");
}


function getDownloadName() {
	var n = new Date();
	var m = n.getMonth().fixZero();
	var d = n.getDate().fixZero();
	var h = n.getHours().fixZero();
	var mi = n.getMinutes().fixZero();

	return "downfaster_" + [m, d, h, mi].join("") + ".zip";
}


window.onload = function() {
	var downloadButton = document.getElementById("download");
	downloadButton.addEventListener("click", function(event) {
		var cEvent = event;
		beginToDownLoad(downloadButton, cEvent);
	}, false);
};

