require('harmony-reflect');
var increment = function(x) {
	x = x + 1;
	console.log(x);
	return x;
};
var handler = {};
handler['apply'] = function(target, thisArg, args) {
	console.log('Before the actual call!');
	var result = target.apply(thisArg, args);
	console.log('After the actual call!');
	return result;
};
increment = new Proxy(increment, handler);

increment(2);