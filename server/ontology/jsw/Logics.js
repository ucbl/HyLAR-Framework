/**
 * Created by MT on 11/09/2015.
 * Logics module
 */

var UNKNOWN = 'unknown';
var Combinatorics = require('js-combinatorics'),
    Utils = require('./Utils'),
    _ = require('lodash');

/**
 * Checks if both sets share exactly the same facts.
 * @param fs1
 * @param fs2
 * @returns {boolean}
 */
var equivalentFactSets = function(fs1, fs2) {
    if (containsFacts(fs2, fs1) && containsFacts(fs1, fs2) && fs1.length == fs2.length) return true;
    return false;
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
    fR.obtainedFrom = Utils.uniqConcat(f1.obtainedFrom, f2.obtainedFrom);
    return fR;
};

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
 * True-like merge, which also merges identical facts' obtainedFrom property.
 * @param fs1
 * @param fs2
 */
var mergeFactSets = function(fs1, fs2) {
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
    leftFactsToString: function() {
        var factConj = '';
        for(var key in this.leftFacts) {
            factConj += ' ^ ' + this.leftFacts[key].toString();
        }
        return factConj.substr(3);
    },

    toString: function() {
        var factConj = '';
        for(var key in this.leftFacts) {
            factConj += ' ^ ' + this.leftFacts[key].toString();
        }
        return factConj.substr(3) + ' -> ' + this.rightFact.toString();
    },

    findConjunctionsWith: function(facts) {
        var combo = Combinatorics.baseN(facts, this.leftFacts.length);
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
            allFacts = Utils.uniqConcat(originalFacts, consequences),
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
                if (!(reattr.appearsIn(candidateConsequences))) {
                    candidateConsequences.push(reattr);
                }
            }
        }
        if(containsFacts(consequences, candidateConsequences)) {
            return consequences;
        }
        var merged = mergeFactSets(consequences, candidateConsequences);
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
 * @constructor
 */
Fact = function(name, li, ri, originFacts) {
    if(!originFacts) originFacts = [];
    this.name = name;
    this.leftIndividual = li;
    this.rightIndividual = ri;
    this.obtainedFrom = originFacts
};

Fact.prototype = {

    toString: function() {
        return this.name + '(' + this.leftIndividual + ',' + this.rightIndividual + ')';
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
            fact: new Fact(this.name, map[this.leftIndividual], map[this.rightIndividual])
        };
    },

    reattribute: function(map) {
        var leftIndividual,
            rightIndividual;
        for (var key in map) {
            if(map[key] === this.leftIndividual)  leftIndividual = key;
            if(map[key] === this.rightIndividual)  rightIndividual = key;
        }
        return new Fact(this.name, leftIndividual, rightIndividual);
    }
};

/**
 * Axiom has the same prototype as Fact,
 * for ease of representation purpose
 * @author Mehdi Terdjimi
 */
Axiom = Fact;

module.exports = {
    rule: function(sla, sra) {
        return new Rule(sla, sra);
    },

    axiom: function(name, li, ri) {
        return new Axiom(name, li, ri);
    },

    fact: function(name, li, ri) {
        return new Fact(name, li, ri);
    }
};