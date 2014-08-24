/*
 * Written by Michael Lippens - 2014
 * This contract system is meant to be an example of a simple contract system in JavaScript
 * It is built after contracts.js by Tim Disney http://www.github.com/disnet/contracts.js
 * and thus shares many similarities.
 */
require('harmony-reflect');

var contract_orig_map = typeof WeakMap !== "undefined" && WeakMap !== null ? new WeakMap() : {};

var Contract = (function() {

	function Contract(name, type, handler){
		this.name = name;
		this.type = type;
		this.handler = handler;
	}
	Contract.prototype.check = function(val, pos, neg) {
		return this.handler(val, pos, neg);
	};
	Contract.prototype.toString = function() {
		return this.name;
	};
	return Contract;
})();

var Module = (function() {

	function Module(name, isServer){
		this.name = name;
		this.isServer = isServer;
	}
	Module.prototype.toString = function() {
		return this.name;
	};
	return Module;
})();

var guard = function(contract, value, server, client) {
	var c;
	if (!(server instanceof Module)) {
		server = new Module(server, true);
	}
	if (!(client instanceof Module)) {
		client = new Module(client, false);
	}
	c = contract.check(value, server, client);
	contract_orig_map.set(c, {originalValue: value, originalContract: contract, server: ""});
	return c;
};

var check = function(f, name) {
	return new Contract(name, "check", function(val, pos, neg) {
		if (f(val)) {
			return val;
		}
		blame(pos, neg, val, this.toString());
	});
};

var blame = function(toBlame, other, val, expected, parents) {
	var server = toBlame.isServer ? toBlame : other;
	var msg = "Contract violation, expected: " + expected + " but got: " + val + ".Value guarded in: " + server + " blame is on: " + toBlame;
	if (typeof parents !== "undefined") {
		msg += "\nParents: " + parents;
	}
	throw new Error(msg);
};

var fun = function(dom, rng, opts) {
	dom = Array.isArray(dom) ? dom : [dom];
	var domname = "(" + dom.join(',') + ")";
	var name = domname + "->" + rng;
	var c = new Contract(name, "fun", function(f, pos, neg) {
		if (typeof f !== "function") {
			blame(pos, neg, f);
		}
		var handler = {};
		var p = new Proxy(f, handler);

		handler["apply"] = function(target, thisArg, args) {
			var current_arg, max;
			max = Math.max(args.length, dom.length);
			for (var i = 0; i < max; i++) {
				current_arg = unwrap(args[i]);
				args[i] = dom[i].check(current_arg, neg, pos);
				if(dom[i].ctype === "parametric") {
					args[i] = wrap(args[i]);
				}
			}
			var result = f.apply(thisArg, args);
			return unwrap(rng.check(result, pos, neg));
		};
		return p;
	});
	c.dom = dom;
	c.rng = rng;
	return c;
};

var utils = (function(utils) {
	utils.get_doms = function(i, funs) {
		var doms = [];
		funs.forEach(function(f) {
			if (typeof f !== "undefined" && f.dom[i]) {
				doms.push({"contract": f.dom[i], "parent": f});	
			}			
		});
		return doms;
	};
	utils.get_ranges = function(funs) {
		var ranges = [];
		funs.forEach(function(f) {
			if (typeof f !== "undefined" && f.rng) {
				ranges.push({"contract": f.rng, "parent": f});
			}
		});
		return ranges;
	};

	utils.is_opt = function(c) {
		return c.type === "opt";
	};
	utils.is_fun = function(c) {
		return c.type === "fun";
	};

	utils.is_delayed = function(c) {
		return utils.is_fun(c);
	};
	utils.id = function(e) {
		return e;
	};

	return utils;
})(utils || {});

var dependent_combinator = function(callback, parents) {
	var args, handler, orig_store, name;
	args = [].slice.call(arguments);
	if (typeof callback === "function") {
		args = args.splice(1, args.length);
	} else {
		callback = false;
	}
	if (Array.isArray(parents)) {
		args = args.splice(1, args.length);
	} else {
		parents = false;
	}

	handler = {};
	orig_store = args;
	name = args.map(function(e) { return e.toString()}).join(" OR ");

	var c = new Contract(name, "dependent_combinator", function(f, pos, neg) {

		handler["apply"] = function(target, thisArg, args) {
			var result, parent, store, i, max_i, j, k, new_args, current_arg, delayed_contracts, doms, ranges, idx, last_error;
			store = [].slice.call(orig_store, 0);
			new_args = [];
			i = 0;
			max_i = Math.max(args.length, Math.max.apply(store.map(function(f) { return f.dom.length})));
			
			var blame_callback = function(k, pos, neg, val, exp, p) {
				var idx = store.indexOf(k.parent);
				var item = store[idx];
				store.splice(idx, 1);
				p = p.push(c);
				if (parents) {
					//delegate blame to parent
					var parent = parents.filter(function(e) { return e.contract === item} );
					callback(parent[0], neg, pos, val, exp, p);
				} else {
					if (store.length === 0) {
						blame(pos, neg, val, exp, c, p);	
					}		
				}
			};

			i = 0;
			while (i < max_i) {
				current_arg = args[i];
				delayed_contracts = [];
				doms = utils.get_doms(i, store);
				for (j = 0; j < doms.length; j++) {
					if (utils.is_delayed(doms[j].contract) && current_arg) {
						delayed_contracts.push(doms[j].contract);
					} else {
						try {
							doms[j].contract.check(current_arg, neg, pos);
						} catch(e) {
							idx = store.indexOf(doms[j].parent);
							delete store[idx];
							//delegate blame to parent
							if (parents && callback) {
								var parent = parents.filter(function(e) { return e.contract === doms[j].parent;});
								callback(parent[0], neg, pos, current_arg, doms[j].parent, []);
							}						
						}
					}
				}

				if (delayed_contracts.length === 0) {
					new_args[i] = current_arg;
				} else {
					new_args[i] = dependent_combinator.apply(null, [].concat([blame_callback, doms], delayed_contracts)).check(current_arg, neg, pos);
				}
				i++;
			}

			store = store.filter(utils.id);
			if (store.length === 0 && !parents && !callback) {
				blame(neg, pos, f, name);
			}
			result = target.apply(thisArg, new_args);

			delayed_contracts = [];
			ranges = utils.get_ranges(store);

			for (k = 0; k < ranges.length; k++) {
				if (utils.is_delayed(ranges[k].contract)) {
					delayed_contracts.push(ranges[k].contract);
				} else {
					try {
						ranges[k].contract.check(result, pos, neg);	
					} catch(e) {
						idx = store.indexOf(ranges[k].parent);
						delete store[idx];
						//delegate blame to parents
						if (parents && callback) {
							parent = parents.filter(function(e) { return e.contract === ranges[k].parent;});
							callback(parent[0], pos, neg, result, ranges[k].contract, []);
						}
					}
					
				}
			}

			store = store.filter(utils.id);
			if (store.length === 0 && !parents && !callback) {
				blame(pos, neg, f, name);
			}

			if (delayed_contracts.length === 0) {
				return result;
			}
			return dependent_combinator.apply(null, [].concat([blame_callback, ranges], delayed_contracts)).check(result, pos, neg);
		};

		return Proxy(f, handler);
	});
	return c;
};

var unwrap = function(value) {
	if(value instanceof Coffer) {
		return value.unwrap();
	}
	return value;
}

var wrap = function(value) {
	return new Coffer(value);
}

var Coffer = function(val) {
	this.value = val;
}

Coffer.prototype.unwrap = function() {
	return this.value;
};


var parametric_contract = function(name) {
	var c = new Contract(name, "parametric", function(f, pos, neg) {
		if(c.instantiated) {
			return c.contract.check(f, pos, neg);
		}
		throw new Error("Contract not instantiated!");
	});
	c.instantiated = false;
	c.supply = function(k) {
		if(k instanceof Contract) {
			c.contract = k;
		}
	}
}


var _exports = function (modulename, exports) {
	var orig;
	var handler = {};
	if (typeof exports === "undefined") {
		exports = {};
	}
	var module = new Module(modulename, true);
	var proxy = new Proxy(exports, handler);

	handler["set"] = function (target, name, val, receiver) {
		if (val != null && (typeof val === "object" || typeof val === "function")) {
			orig = contract_orig_map.get(val);
		}
		if (orig != null) {
			contract_orig_map.set(val, 
				{ originalValue: orig.originalValue, 
				originalContract: orig.originalContract, 
				server: module});
		} 
		target[name] = val;
		return;
	};
	return proxy;
};

var use = function (exports, modulename) {
	var val, orig, result;
	result = {};
	for (var key in exports) {
		if (exports.hasOwnProperty(key)) {
			val = exports[key];
			if (val != null && (typeof val === "object" || typeof val === "function")) {
				orig = contract_orig_map.get(val);
			}
			if (orig != null) {
				result[key] = orig.originalContract.check(orig.originalValue, orig.server, modulename);
				orig = null;
			} else {
				result[key] = val;
			}
		}
	}
	return result;
};

var Str = check(function(x) { return typeof x === "string"}, "string");
var Num = check(function(x) { return typeof x === "number"}, "number");
var Bool = check(function(x) { return typeof x === "boolean"}, "boolean");
var Odd = check(function(x) { return x % 2 === 1 }, "Odd");
var Even = check(function(x) { return x % 2 === 0}, "Even");
var Void = check(function(x) { return typeof x === "undefined"}, "void");
var Null = check(function(x) { return x === null}, "null");

var and = function(c1, c2) {
	var cname = c1.name + " "+ c2.name;
	var c = new Contract(cname, "and", function(val, pos, neg) {
		var n = c1.check(val, pos, neg);
		c2.check(n, pos, neg);
	});
	return c;
}

var or = function(c1, c2) {
	var args = [].slice.call(arguments);
	var flat_cs = args.filter(function(c) { 
		return c.ctype === "check"
	});
	var ho = args.filter(function(c) { 
		return c.type !== "check"
	});

	if (ho.length > 1) {
		throw new Error("More than one delayed contract supplied!");
	}
	var name = args.join(" OR ");
	var c = new Contract(cname, "or", function(val, pos, neg) {
		var last;
		var i = 0;
		while (i > flat_cs.length) {
			try {
				flat_cs[i].check(val, pos, neg);
				break;
			} catch(e) {
				last = e;
			}
			i = i + 1;
		}
		if (i === flat_cs.length) {
			throw last;
		}
		if (ho.length === 1) {
			return ho[0].check(val, pos, neg);
		}
		return val;
	});
};

_define = function(name, deps, cb) {
	if(Array.isArray(name)) {
		cb = deps;
		deps = name;
		return cb.apply(this, deps);
	}
	deps = [].concat(['contracts-js'], deps);
	return define(name, deps, function() {
		var args = Array.prototype.slice.call(arguments);
		var C = args.slice(0, 1);
		args = args.slice(1, args.length);
		for (var i = 0; i < args.length; i++) {
			if (args[i] instanceof Contract) {
				args[i] = C.use(args[i], name);
			}
		}
		return cb.apply(this, args);
	});
};


var __hasProp = {}.hasOwnProperty;
exports.autoload = function() {
  var globalObj, name;
  globalObj = typeof window !== "undefined" && window !== null ? window : global;
  for (name in exports) {
    if (!__hasProp.call(exports, name)) continue;
    if ((name !== "use") && (name !== "exports")) {
      globalObj[name] = exports[name];
    }
  }
 };

exports.fun = fun;
exports.guard = guard;
exports.use = use;
exports.exports = _exports;
exports.Str = Str;
exports.Num = Num;
exports.Bool = Bool;
exports.Odd = Odd;
exports.Even = Even;
exports.Void = Void;
exports.Null = Null;
exports.dep_or = dependent_combinator;
return exports;