var chai = require('chai');
var expect = chai.expect;
var __contracts = require('./../lib/contracts');
__contracts.autoload();

var violation = /Contract violation/;

describe('Testing basic combined dependent contracts', function() {
	var c = fun([Str], Num);
	var k = fun([Num], Str);
	var o = dep_or(c, k);

	var f = guard(o, function(){}, "f", "client");
	var g = guard(o, function(){ return ""});
	var h = guard(o, function(){ return 2});
	it('should throw a violation', function() {
		expect(function() { f("ho")}).to.throw(violation);
		expect(function() { f(2)}).to.throw(violation);
		expect(function() { f()}).to.throw(violation);
		expect(function() { f({})}).to.throw(violation);	
	});
	it('should not throw a violation', function() {
		expect(function(){ g(2)}).to.not.throw(violation);
		expect(function(){ h("ho")}).to.not.throw(violation);
	});
	it('should throw a violation', function() {
		expect(function(){ g("")}).to.throw(violation);
		expect(function(){ h(2)}).to.throw(violation);
	});
});

describe('Testing higher-order combined dependent contracts', function() {
	var c = fun([fun([], Str)], Void);
	var k = fun([fun([Str], Void)], Void);
	var o = dep_or(c, k);

	var f = guard(o, function(g) {
		g();
	});
	var g = guard(o, function(h) {
		h("");
	});

	it('should throw violation', function() {
		expect(function() { f(function(){ return 2})}).to.throw(violation);
		expect(function() { f(function(){ return null;})}).to.throw(violation);
	});

	it('should not throw', function() {
		expect(function() { f(function() { return "foo"})}).to.not.throw();
		expect(function() { g(function(){})}).to.not.throw();
	});

	var c_1 = fun([], fun([Str], Num));
	var c_2 = fun([], fun([], Void));
	var o_2 = dep_or(c_1, c_2);

	var h = guard(o_2, function() {
		return function() {
			return 2;
		};
	});

	it('should throw', function() {
		expect(function() { h()(2);}).to.throw(violation);
	});

	it('should not throw', function() {
		expect(function() { h()("hi")}).to.not.throw();
	});
});
