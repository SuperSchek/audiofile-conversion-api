const express = require('express'),
      ffmpeg = require('fluent-ffmpeg'),
      path = require('path'),
      fileUpload = require('express-fileupload'),
      fs = require('fs'),
      app = express(),
      port = process.env.PORT || 3000;


app.use(fileUpload());

app.listen(port, () => {
    console.log('API is running on: ' + port);

    app.post('/upload', (req, res) => {
        let getFile = function(data) {
            console.log('getFile');
            return new Promise(function(resolve, reject) {
                if (!req.files)
                    return res.status(400).send('No files were uploaded.');
                
                let podcast = new Object();

                const submitted_file = req.files.audio;
                podcast.extension = submitted_file.name.split('.').pop();
                podcast.filename = (req.body.category + '_' + req.body.name).replace(/\s/g, '');

                let moveFile = function(obj) {
                    return new Promise(function(resolve, reject) {
                        submitted_file.mv(podcast.filename + '_original.' + podcast.extension, function(err) {
                            if (err)
                                return res.status(500).send(err);

                            // res.send('File uploaded');
                            resolve(podcast);
                        });
                    });
                };
            
                moveFile().then(function(obj) {                  
                    return resolve(obj);
                })

            });
        };

        let secondProm = function(obj) {
            return new Promise(function(resolve, reject) {
                ffmpeg(obj.filename + '_original.' + obj.extension)
                .audioBitrate('128')
                .toFormat('mp3')
                .on('error', function (err) {
                    return res.status(500).send(err);
                    console.log('An error occurred: ' + err.message);
                })
                .on('progress', function (progress) {
                    // console.log(JSON.stringify(progress));
                    console.log('Processing: ' + progress.targetSize + ' KB converted');
                })
                .on('end', function () {
                    console.log('Processing finished !');
                    resolve(obj);                    
                })
                .save('./hello.mp3')//path where you want to save your file

                // res.sendFile(path.join(__dirname, '/', obj.filename + '_original.' + obj.extension), function() {
                //     fs.unlinkSync(obj.filename + '_original.' + obj.extension);
                //     resolve(obj);
                // });
                
            });
        };

        let thirdProm = function(obj) {
            return new Promise(function(resolve, reject) {
                res.sendFile(path.join(__dirname, '/',  'hello.mp3'), function() {
                    fs.unlinkSync(obj.filename + '_original.' + obj.extension);
                    fs.unlinkSync('hello.mp3');                    
                    resolve(obj);
                });
            });
        };

        getFile().then(function(result) {
            return secondProm(result);
        }).then(function(result) {
            return thirdProm(result);
        }).then(function(obj) {
            console.log("Done: Sending file now!");
            console.log(obj);
            console.log('sent');
        });
    });

    // app.post('/upload', (req, res) => {
    //     // Check for files
    //     if (!req.files)
    //         return res.status(400).send('No files were uploaded.');

    //     const submitted_file = req.files.audio;
    //     const extension = submitted_file.name.split('.').pop();
    //     const filename = (req.body.category + '_' + req.body.name).replace(/\s/g, '');

    //     function upload() {
    //         return new Promise(function(resolve, reject) {
    //             submitted_file.mv(filename + '.' + extension, function(err) {
    //                 if (err)
    //                     return res.status(500).send(err);
    //                 // res.send('File uploaded');
    //                 console.log('uploaded');
    //                 resolve();
    //             });
    //         });
    //     }

    //     function postFile() {
    //         return new Promise(function(resolve, reject) {
    //             res.sendFile(path.join(__dirname, '/', filename + '.' + extension));
    //             console.log('sent');
    //             resolve();
    //         });
    //     };
        
    //     upload().then(function() {
    //         // res.sendFile("./Review_Molly'sGame.mp3");
    //         postFile().then(function() {
    //             console.log('deleting');
    //             fs.unlinkSync(filename + '.' + extension);
    //         });
    //     });

    // });
});