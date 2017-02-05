

Node = function(name, id) {
	this.name = name;
	this.id = id;
	this.children = null;
};

Node.prototype.addChild = function(child) {
	if (!this.children) {
		this.children = [];
	}
	this.children.push(child);
};

Clone = function(obj) {
	return JSON.parse(JSON.stringify(obj));
}