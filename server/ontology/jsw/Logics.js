/**
 * Created by MT on 11/09/2015.
 * Logics module
 */

var UNKNOWN = 'unknown';
var Combinatorics = require('js-combinatorics'),
    Utils = require('./Utils'),
    _ = require('lodash');

String.prototype.toRuleSet = function() {
    return Core.parseStrRule(this);
};

/**
 * Checks if a set of facts is a subset of another set of facts.
 * @param fs1 the superset
 * @param fs2 the potential subset
 */
var containsFacts = function(fs1, fs2) {
    if(!fs2 || (fs2.length > fs1.length)) return false;
    for (var key in fs2) {
        var fact = _.cloneDeep(fs2[key]);
        fact.__proto__ = Fact.prototype;
        if(!(fact.appearsIn(fs1))) {
            return false;
        }
    }
    return true;
};

/**
 * Merges two facts' obtainedWith properties
 * if they are equivalent (otherwise, returns false).
 */
var mergeFacts = function(f1, f2) {
    var fR = _.cloneDeep(f1);
    if(!(f1.equivalentTo(f2))) {
        return false;
    }
    fR.__proto__ = Fact.prototype;
    fR.obtainedFrom = _.union(f1.obtainedFrom, f2.obtainedFrom);
    if (fR.obtainedFrom.length > 0) fR.explicit = false;
    return fR;
};

/**
 * Returns the max and min from two sets of facts
 * (cloning)
 * @param fs1
 * @param fs2
 * @returns {{max: *, min: *}}
 */
var maxMin = function(fs1, fs2) {
    if (fs1.length > fs2.length) return {
        max: _.cloneDeep(fs1),
        min: _.cloneDeep(fs2)
    };
    return {
        max: _.cloneDeep(fs2),
        min: _.cloneDeep(fs1)
    };
};

/**
 * Finds the fact in the set
 * and merges both obtainedFrom properties.
 */
var findAndMerge = function(fs, fact) {
    for(var key in fs) {
        var merged;
        fs[key].__proto__ = Fact.prototype;
        if(merged = mergeFacts(fs[key], fact)) {
            fs[key] = merged;
        }
    }
};

/**
 * Rule in the form subClassOf(a, b) ^ subClassOf(b, c) -> subClassOf(a, c)
 * i.e. conjunction of facts
 * @param slf set of (left side) conjunctive facts
 * @param ra the consequence facts
 * @constructor
 */
Rule = function(slf, rf) {
    this.leftFacts = slf;
    this.rightFact = rf;
};

Rule.prototype = {
    /**
     * Convenient method to stringify the set of
     * left-side facts of a rule.
     * @returns {string}
     */
    leftFactsToString: function() {
        var factConj = '';
        for(var key in this.leftFacts) {
            factConj += ' ^ ' + this.leftFacts[key].toString();
        }
        return factConj.substr(3);
    },

    /**
     * Convenient method to stringify a rule.
     * @returns {string}
     */
    toString: function() {
        var factConj = '';
        for(var key in this.leftFacts) {
            factConj += ' ^ ' + this.leftFacts[key].toString();
        }
        return factConj.substr(3) + ' -> ' + this.rightFact.toString();
    },

    /**
     * Finds all possible conjunctions of
     * N facts from a set (cardinality of the conjunction = N)
     * @param facts
     * @returns {Array|*}
     */
    findConjunctionsWith: function(facts) {
        var combo;
        try {
            combo = Combinatorics.baseN(facts, this.leftFacts.length);
        } catch(e) {
            throw 'Combinatorics exception';
        }
        return combo.toArray();
    },

    /**
     * Returns the consequences of the facts being applied to the rule.
     * @returns {boolean}
     */
    consequences: function(originalFacts, consequences) {

        if (!consequences) consequences = [];

        var thisPatternized = this.patternize(),
            thisRule = thisPatternized.rule,
            initialMap = thisPatternized.map,
            allFacts = Core.mergeFactSets(originalFacts, consequences),
            possibleConjunctions,
            candidateConsequences = [];

        // Calculation of all possible permuted combinations
        possibleConjunctions = this.findConjunctionsWith(allFacts);

        // Checks if any conjunction shares the same pattern as current rule
        for (var key in possibleConjunctions) {
            var patternized = new Rule(possibleConjunctions[key], UNKNOWN).patternize(),
                shadowRule = patternized.rule,
                map = patternized.map;

            if(shadowRule.leftFactsToString() === thisRule.leftFactsToString()) {
                var reattr = thisRule.rightFact.reattribute(Utils.completeMap(map,initialMap));
                reattr.obtainedFrom = possibleConjunctions[key];
                reattr.explicit = false;
                if (!(reattr.appearsIn(candidateConsequences))) {
                    candidateConsequences.push(reattr);
                }
            }
        }
        if(containsFacts(consequences, candidateConsequences)) {
            return consequences;
        }
        var merged = Core.mergeFactSets(consequences, candidateConsequences);
        return this.consequences(originalFacts, merged);
    },

    /**
     * Generalizes a rule, e.g. the patternization of
     * hasChild(#Dad, #Kid) ^ hasBrother(#Dad, #Uncle) -> hasUncle(#Kid, #Uuncle)
     * would produce
     * hasChild(0, 1) ^ hasBrother(0, 2) -> hasUncle(1, 2)
     * @returns a JSON object containing:
     *          - map: the mapping between original variables (#Dad, #Kid, #Uncle)
     *                 and their patternized version (0, 1, 2)
     *          - rule: the patternized rule
     */
    patternize: function(map) {
        if(map === undefined) map = {};
        var leftFacts = [],
            rightFacts = [],
            patternized;

        _(this.leftFacts).forEach(function(fact) {
            fact.__proto__ = Fact.prototype;
            try {
                patternized = fact.patternize(map);
                leftFacts.push(patternized.fact);
                map = patternized.map;
            } catch(e) {
                throw(e);
            }
        });

        if(this.rightFact !== UNKNOWN) {
            patternized = this.rightFact.patternize(map);
            rightFacts = patternized.fact;
            map = patternized.map;
        }

        return {
            map: map,
            rule: new Rule(leftFacts, rightFacts)
        };
    }
};

/**
 * Fact in the form subClassOf(a, b)
 * @param name fact's/axiom name (e.g. subClassOf)
 * @param li left individual
 * @param ri right individual
 * @param originFacts array of facts causing this
 * @constructor
 */
Fact = function(name, li, ri, originFacts, expl) {
    if(!originFacts) originFacts = [];
    if(originFacts.length > 0 && expl == true) {
        throw 'A fact cannot be explicit if it has one or more origin facts.';
    }
    if(originFacts.length == 0 && expl == false) {
        throw 'A fact cannot be implicit if it has no origin facts.';
    }

    this.name = name;
    this.leftIndividual = li;
    this.rightIndividual = ri;
    this.obtainedFrom = originFacts;
    this.explicit = expl;
};

Fact.prototype = {

    /**
     * Convenient method to stringify a fact.
     * @returns {string}
     */
    toString: function() {
        return 'T(' + this.leftIndividual + ', ' + this.name + ', ' + this.rightIndividual + ')';
    },

    /**
     * Checks if the fact is equivalent to another fact.
     * @param fact
     * @returns {boolean}
     */
    equivalentTo: function(fact) {
        fact.__proto__ = Fact.prototype;
        if(this.toString() == fact.toString()) {
            return true;
        }
        return false;
    },

    /**
     * Checks if a fact appears in a set of facts
     * and returns it if existing.
     * @param factSet
     * @returns {boolean}
     */
    appearsIn: function(factSet) {
        var that = this;
        for (var key in factSet) {
            if(that.equivalentTo(factSet[key])){
               return factSet[key];
            }
        }
        return false;
    },

    /**
     * Returns true if a fact f
     * is obtainedFrom (this) fact
     */
    causes: function(f) {
        return this.appearsIn(f.obtainedFrom);
    },

    /**
     * Gets all facts from the set fs that have been obtained using
     * the current fact (this), recursively.
     * @param fs
     */
    getConsequencesIn: function(fs, initialCons) {
        if (!initialCons) initialCons = [];
        for (var key in fs) {
            var fact = fs[key];
            fact.__proto__ = Fact.prototype;
            if (!fact.appearsIn(initialCons) && this.causes(fact)) {
                initialCons.push(fact);
                initialCons = fact.getConsequencesIn(fs, initialCons);
            }
        }
        return initialCons;
    },

    /**
     * Generalizes an axiom/fact, e.g. the patternization of
     * hasChild(#Dad, #Kid) would produce hasChild(0, 1)
     * @param map: the original mapping of variables, if needed
     * @returns a JSON object containing:
     *          - map: the mapping between original variables
     *                 and their patternized version
     *          - fact: the patternized fact/axiom
     */
    patternize: function(map) {
        if(map === undefined) map = {};
        if (map[this.leftIndividual] === undefined) {
            map[this.leftIndividual] = Object.keys(map).length;
        }
        if(map[this.rightIndividual] === undefined) {
            map[this.rightIndividual] = Object.keys(map).length;
        }
        return {
            map: map,
            fact: new Fact(this.name,
                map[this.leftIndividual],
                map[this.rightIndividual],
            this.obtainedFrom,
            this.explicit)
        };
    },

    /**
     * Reattribute values in a pattern
     * using the corresponding map.
     * @param map
     * @returns {Fact}
     */
    reattribute: function(map) {
        var leftIndividual,
            rightIndividual;
        for (var key in map) {
            if(map[key] === this.leftIndividual)  {
                leftIndividual = key;
            }
            if(map[key] === this.rightIndividual)  {
                rightIndividual = key;
            }
        }
        return new Fact(this.name, leftIndividual, rightIndividual);
    },

    relatedTo: function(rule) {
        var facts = rule.leftFacts;
        if(this.appearsIn(facts)) return true;
        return false;
    }
};

/**
 * All necessary stuff around the Logics module
 * @type {{substractFactSets: Function, mergeFactSets: Function}}
 */
Core = {
    /**
     * Returns fs1 without the facts occuring in fs2.
     * @param fs1
     * @param fs2
     */
    substractFactSets: function(fs1, fs2) {
        var fsR = [];
        for (var key in fs1) {
            var fact = fs1[key];
            fact.__proto__ = Fact.prototype;
            if (!fact.appearsIn(fs2)) {
                fsR.push(fact);
            }
        }
        return fsR;
    },

    /**
     * True-like merge, which also merges
     * identical facts obtainedFrom properties.
     * @param fs1
     * @param fs2
     */
    mergeFactSets: function(fs1, fs2) {
        if(fs1.length == 0) return fs2;
        if(fs2.length == 0) return fs1;

        var fsMx = maxMin(fs1, fs2).max,
            fsMn = maxMin(fs1, fs2).min;

        for (var key in fsMn) {
            fsMn[key].__proto__ = Fact.prototype;
            var simili =  fsMn[key].appearsIn(fsMx);
            if(simili) {
                findAndMerge(fsMx, simili);
            } else {
                fsMx.push(fsMn[key]);
            }
        }
        return fsMx;
    },

    getOnlyImplicitFacts: function(fs) {
        var fR = [];
        for (var key in fs) {
            var fact = fs[key];
            fact.__proto__ = Fact.prototype;
            if(!fact.explicit) {
                fR.push(fact);
            }
        }
        return fR;
    },

    getOnlyExplicitFacts: function(fs) {
        var fR = [];
        for (var key in fs) {
            var fact = fs[key];
            fact.__proto__ = Fact.prototype;
            if(fact.explicit) {
                fR.push(fact);
            }
        }
        return fR;
    },

    evaluateRuleSet: function(rs, fs) {
        var cons = []
        for (var key in rs) {
            var subsequentConsequences = rs[key].consequences(this.mergeFactSets(cons, fs));
            cons = this.mergeFactSets(cons, subsequentConsequences);
        }
        return cons;
    },

    restrictRuleSet: function(rs, fs) {
        var restriction = []
        for(var rkey in rs) {
            var rule = rs[rkey],
                rpat = rule.patternize(),
                pRule = rpat.rule;
            for (var fkey in fs) {
                var fact = fs[fkey],
                    fpat = fact.patternize(),
                    pFact = fpat.fact;
                if(pFact.relatedTo(pRule)) {
                    restriction.push(rule);
                    break;
                }
        }
        }
        return restriction;
    },

    /**
     * Parses string rules in the form
     * T(?s, ?p1, ?o) ^ T(?s ?p2 ?o) -> T(?s, ?p2, ?o) ...
     * x-- SPACES ARE MANDATORY --x
     * @param str
     */
    parseStrRule: function(str) {
        var leftRgxp = /.+ ->/g,
            rightRgxp = /-> .+/g,
            conj = ' ^ ',
            leftMatches = str.match(leftRgxp),
            rightMatches = str.match(rightRgxp),
            leftfs = [], ruleSet = [];

        if(str.length) {

            var lFacts = leftMatches[0].replace(' ->', '').split(conj),
                rFacts = rightMatches[0].replace('-> ', '').split(conj);

            for (var key in lFacts) {
                leftfs.push(this.parseStrFact(lFacts[key]));
            }

            for (var key in rFacts) {
                var rFact = this.parseStrFact(rFacts[key]);
                ruleSet.push(new Rule(leftfs, rFact));
            }
        }

        return ruleSet;
    },

    /**
     * Parse fact in the form
     * T(?s, ?p1, ?o)
     */
    parseStrFact: function(str) {
        var membersRgxp = /\((.+), (.+), (.+)\)/i,
            matches = str.match(membersRgxp);
        return new Fact(matches[2], matches[1], matches[3], [], true);
    }
};

module.exports = {
    rule: function(sla, sra) {
        return new Rule(sla, sra);
    },

    fact: function(name, li, ri, obt, expl) {
        return new Fact(name, li, ri, obt, expl);
    },

    core: Core
};