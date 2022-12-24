"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
exports.ProposalContext = exports.countdownSeconds = exports.sleep = void 0;
var node_json_db_1 = require("node-json-db");
var JsonDBConfig_1 = require("node-json-db/dist/lib/JsonDBConfig");
var sleep = function (ms) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        return [2 /*return*/, new Promise(function (resolve) { return setTimeout(resolve, ms); })];
    });
}); };
exports.sleep = sleep;
var countdownSeconds = function (secs) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (!true) return [3 /*break*/, 2];
                console.log(secs);
                return [4 /*yield*/, (0, exports.sleep)(1000)];
            case 1:
                _a.sent();
                secs = secs - 1;
                if (secs < 1) {
                    return [2 /*return*/];
                }
                return [3 /*break*/, 0];
            case 2: return [2 /*return*/];
        }
    });
}); };
exports.countdownSeconds = countdownSeconds;
var ProposalContext = /** @class */ (function () {
    function ProposalContext(name) {
        this.deploys = new Map();
        this.steps = [];
        this.name = name;
        this.db = new node_json_db_1.JsonDB(new JsonDBConfig_1.Config("./proposals/" + name + ".proposal", true, true, "."));
    }
    ProposalContext.prototype.addStep = function (p, sig) {
        this.steps.push({ p: p, sig: sig });
    };
    ProposalContext.prototype.populateProposal = function () {
        var out = {
            targets: [],
            values: [],
            signatures: [],
            calldatas: []
        };
        for (var _i = 0, _a = this.steps; _i < _a.length; _i++) {
            var av = _a[_i];
            var v = av.p;
            out.calldatas.push(v.data ? "0x" + v.data.substring(10) : "");
            out.signatures.push(av.sig);
            out.values.push(v.value ? v.value : 0);
            out.targets.push(v.to ? v.to : "0x0000000000000000000000000000000000000000");
        }
        return out;
    };
    ProposalContext.prototype.sendProposal = function (charlie, description, emergency) {
        return __awaiter(this, void 0, void 0, function () {
            var out, txn;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        out = this.populateProposal();
                        return [4 /*yield*/, charlie
                                .propose(out.targets, out.values, out.signatures, out.calldatas, description, emergency ? true : false)
                                .then(function (res) { return __awaiter(_this, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            this.db.push(".proposal.proposeTxn", res.hash);
                                            return [4 /*yield*/, res.wait()];
                                        case 1:
                                            _a.sent();
                                            return [2 /*return*/];
                                    }
                                });
                            }); })];
                    case 1:
                        txn = _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    ProposalContext.prototype.AddDeploy = function (name, deployment) {
        this.deploys.set(name, deployment);
    };
    ProposalContext.prototype.DeployAddress = function (n) {
        var x = this.db.getData(".deploys." + n);
        return x ? x : "";
    };
    ProposalContext.prototype.DeployAll = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _loop_1, this_1, _i, _a, _b, k, v;
            var _this = this;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _loop_1 = function (k, v) {
                            var dbv;
                            return __generator(this, function (_d) {
                                switch (_d.label) {
                                    case 0:
                                        dbv = this_1.db.exists(".deploys." + k);
                                        if (!!dbv) return [3 /*break*/, 2];
                                        console.log("deploying:", k);
                                        return [4 /*yield*/, v()
                                                .then(function (x) { return __awaiter(_this, void 0, void 0, function () {
                                                var _this = this;
                                                return __generator(this, function (_a) {
                                                    return [2 /*return*/, x.deployed().then(function () {
                                                            _this.db.push(".deploys." + k, x.address);
                                                        })];
                                                });
                                            }); })["catch"](function (e) {
                                                console.log("failed to deploy ".concat(k, ", ").concat(e));
                                            })];
                                    case 1:
                                        _d.sent();
                                        _d.label = 2;
                                    case 2: return [2 /*return*/];
                                }
                            });
                        };
                        this_1 = this;
                        _i = 0, _a = this.deploys.entries();
                        _c.label = 1;
                    case 1:
                        if (!(_i < _a.length)) return [3 /*break*/, 4];
                        _b = _a[_i], k = _b[0], v = _b[1];
                        return [5 /*yield**/, _loop_1(k, v)];
                    case 2:
                        _c.sent();
                        _c.label = 3;
                    case 3:
                        _i++;
                        return [3 /*break*/, 1];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    return ProposalContext;
}());
exports.ProposalContext = ProposalContext;
