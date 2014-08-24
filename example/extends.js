var extends = function (child, parent) {
    for (var property in parent) {
    	if(parent.hasOwnProperty(property)) {
    		child[property] = parent[property];		
    	} 
    } 
    function constructor() { 
    	this.constructor = child; 
    }
    constructor.prototype = parent.prototype;
    child.prototype = new constructor();
};
