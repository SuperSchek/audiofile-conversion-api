const express = require('express'),
    //   Promise = require('promise'),
      path = require('path'),
      fileUpload = require('express-fileupload'),
      app = express(),
      port = process.env.PORT || 3000;


app.use(fileUpload());

app.listen(port, () => {
    console.log('RESTful API server started on: ' + port);

    app.post('/upload', (req, res) => {
        // Check for files
        if (!req.files)
            return res.status(400).send('No files were uploaded.');

        const submitted_file = req.files.audio;
        const extension = submitted_file.name.split('.').pop();
        const filename = (req.body.category + '_' + req.body.name).replace(/\s/g, '');

        function upload() {
            return new Promise(function(resolve, reject) {
                submitted_file.mv(filename + '.' + extension, function(err) {
                    if (err)
                        return res.status(500).send(err);
                    resolve();                        
                    console.log('File uploaded');
                });
            });
        }
        
        upload().then(function() {
            // res.sendFile("./Review_Molly'sGame.mp3");
            res.sendFile(path.join(__dirname, '/', filename + '.' + extension));
        });

    });
});