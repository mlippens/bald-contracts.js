var C = require("./../lib/contracts");
C.autoload();

//var f = guard(Str, 2, "server", "client");

var o = fun(Str, Num);

f = guard(o, function(){ return 2;});
//f(2);

var g = guard(o, function(){ return "foo";});
//g("foo");

var k = fun(C.fun(Str,Num), Str);
f = guard(k, function(f) {
		f(2);
		return "foo";
	});

//f(function(){ return "foo" });

var exp = C.exports("Sample");

exp.foo = guard(fun(fun(Num, Str), Str), function(f) { f("bar");return "foo"});
module.exports = exp;