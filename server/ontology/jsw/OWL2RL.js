/**
 * Created by MT on 17/09/2015.
 */

/**
 * OWL2RL spec from http://www.w3.org/TR/owl2-profiles
 * @author Mehdi Terdjimi
 * @type {{rules: *[]}}
 */

var Logics = require('./Logics'),
    JswRDF = require('./JswRDF'),
    JswOWL = require('./JswOWL');

module.exports = {
    rules: [
        // scm-sco
        new Logics.rule([
                new Logics.axiom(JswRDF.IRIs.SUBCLASS, '?c1', '?c2'),
                new Logics.axiom(JswRDF.IRIs.SUBCLASS, '?c2', '?c3')],
            new Logics.axiom(JswRDF.IRIs.SUBCLASS, '?c1', '?c3')),

        // cax-sco
        new Logics.rule([
                new Logics.axiom(JswRDF.IRIs.SUBCLASS, '?c1', '?c2'),
                new Logics.axiom(JswRDF.IRIs.TYPE, '?x', '?c1')],
            new Logics.axiom(JswRDF.IRIs.TYPE, '?x', '?c2')),

        // scm-cls
        new Logics.rule([
                new Logics.axiom(JswRDF.IRIs.TYPE, '?c', JswOWL.IRIs.CLASS)],
            new Logics.axiom(JswRDF.IRIs.SUBCLASS, '?c', '?c')),
        new Logics.rule([
                new Logics.axiom(JswRDF.IRIs.TYPE, '?c', JswOWL.IRIs.CLASS)],
            new Logics.axiom(JswOWL.IRIs.EQUIVALENT_CLASS, '?c', '?c')),
        new Logics.rule([
                new Logics.axiom(JswRDF.IRIs.TYPE, '?c', JswOWL.IRIs.CLASS)],
            new Logics.axiom(JswRDF.IRIs.SUBCLASS, '?c', JswOWL.IRIs.THING)),
        new Logics.rule([
                new Logics.axiom(JswRDF.IRIs.TYPE, '?c', JswOWL.IRIs.CLASS)],
            new Logics.axiom(JswRDF.IRIs.SUBCLASS, JswOWL.IRIs.NOTHING, '?c'))
    ]
};