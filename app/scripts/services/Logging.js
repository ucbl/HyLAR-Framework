/**
 * Created by Spadon on 20/02/2015.
 */

app.service('LoggingService', function() {

    var msgData;

    this.log = [];

    this.msg = function(content) {
        msgData = new Object();
        msgData.msg = content;
        msgData.isError = false;
        return this;
    };

    this.err = function(content) {
        msgData = new Object();
        var elem = document.createElement('textarea');
        elem.innerHTML = content;
        content = elem.value;
        msgData.msg = content;
        msgData.isError = true;
        return this;
    };

    this.submit = function() {
        msgData.time = new Date().getTime();
        this.log.push(msgData);
    }
});