require('harmony-reflect');

var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};

var Foo = (function () {
    function Foo() {
    }
    Foo.prototype.swing = function() {};
    return Foo;
})();

var FooProxy;

FooProxy = Proxy(Foo, {});
FooProxy.prototype = Proxy(Foo.prototype, {});

/*FooProxy = Proxy(Foo, {"get": function(rec, name) {
    if(name === "prototype") {
        var p = Proxy(rec.prototype, {});
        return p;
    }
    return rec[name];
}});*/

var Bar = (function (_super) {
    __extends(Bar, _super);
    function Bar() {
        _super.apply(this, arguments);
    }
    Bar.prototype.throw_axe = function() {};
    return Bar;
})(FooProxy);


var i = new Bar();
console.log(i instanceof Foo);

