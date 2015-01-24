/**
 * Created by Spadon on 20/01/2015.
 */

exports.config = {
    seleniumAddress: 'http://localhost:4444/wd/hub',
    specs: ['todo_spec.js'],
    capabilities: {
        count: 20,
        browserName: 'chrome',
        shardTestFiles: true,
        maxInstances: 20
    }

};