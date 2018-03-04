const express = require('express'),
      ffmpeg = require('fluent-ffmpeg'),
      path = require('path'),
      fileUpload = require('express-fileupload'),
      fs = require('fs'),
      AWS = require('aws-sdk'),
      app = express(),
      port = process.env.PORT || 3000;

// Load env vars from .env file if not in production.
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').load();
}

const AWS_S3_BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME;
const AWS_S3_USER_KEY = process.env.AWS_S3_USER_KEY;
const AWS_S3_USER_SECRET = process.env.AWS_S3_USER_SECRET;

app.use(fileUpload());

app.listen(port, () => {
    console.log('API is running on: ' + port);

    app.get('/test', (req, res) => {
         console.log('joe');
         res.send('Joe!');
    });

    app.post('/deploy', (req, res) => {
      console.log(req.body.pusher.name + ' just pushed to ' + req.body.repository.name);

      if (process.env.NODE_ENV == 'production') {
        console.log('Pulling code from GitHub...');

        // Reset any local changes
        exec('git -C ~/Node/filmerds-podcast-conversion-api reset --hard', execCallback);

        // and ditch any locally added files
        exec('git -C ~/Node/filmerds-podcast-conversion-api clean -df', execCallback);

        // now pull down the latest
        exec('git -C ~/Node/filmerds-podcast-conversion-api pull -f', execCallback);

        // Run npm install with --production
        exec('npm -C ~/Node/filmerds-podcast-conversion-api install --production', execCallback);

        // and run tsc
        exec('tsc ~/Node/filmerds-podcast-conversion-api clean -df', execCallback);
      } else {
        console.log('Not running on production. Not pulling latest code from GitHub.');
      }
    });

    function execCallback(err, stdout, stderr) {
      if(stdout) console.log(stdout);
      if(stderr) console.log(stderr);
    };

    app.post('/convert', (req, res) => {
        // Download file from post request to server.
        let getFile = function(data) {
            return new Promise(function(resolve, reject) {
                if (!req.files)
                    return res.status(400).send('No files were uploaded.');

                let podcast = new Object();

                const submitted_file = req.files.audio;
                podcast.extension = submitted_file.name.split('.').pop();
                podcast.filename = (req.body.category + '_' + req.body.name).replace(/[\s':#|,;!&]/g, ''); //Remove any spaces, comma's or colons from filename.

                let moveFile = function(obj) {
                    return new Promise(function(resolve, reject) {
                        submitted_file.mv(podcast.filename + '_original.' + podcast.extension, function(err) {
                            if (err)
                                return res.status(500).send(err);

                            resolve(podcast);
                        });
                    });
                };

                moveFile().then(function(obj) {
                    console.log('File received.');
                    return resolve(obj);
                })

            });
        };

        // Convert audiofile to a 128kbps .mp3 file.
        let convertFile = function(obj) {
            return new Promise(function(resolve, reject) {
                console.log('Converting ' + obj.filename + '_original.' + obj.extension + ' to 128kbps mp3 using ffmpeg!')
                ffmpeg(obj.filename + '_original.' + obj.extension)
                .audioBitrate('128')
                .toFormat('mp3')
                .on('error', function (err) {
                    return res.status(500).send(err);
                    console.error('An error occurred: ' + err.message);
                })
                .on('progress', function (progress) {
                    // console.log(JSON.stringify(progress));
                    console.log('Processing: ' + progress.targetSize + ' KB converted');
                })
                .on('end', function () {
                    console.log('Processing finished.');
                    resolve(obj);
                })
                .save(obj.filename + '.mp3')//path where you want to save your file
            });
        };

        // Delete original file.
        let deleteOriginal = function(obj) {
            return new Promise(function(resolve, reject) {
                fs.unlinkSync(obj.filename + '_original.' + obj.extension);
                resolve(obj);
            });
        };

        getFile().then(function(result) {
            return convertFile(result);
        }).then(function(result) {
            return deleteOriginal(result);
        }).then(function(obj) {
            uploadToS3(obj);
        });

        function uploadToS3(obj) {
            console.log("Uploading " + obj.filename + ".mp3 to AWS S3!");
            let s3bucket = new AWS.S3({
                accessKeyId: AWS_S3_USER_KEY,
                secretAccessKey: AWS_S3_USER_SECRET,
                Bucket: AWS_S3_BUCKET_NAME,
            });
            fs.readFile(obj.filename + '.mp3', function(err, data) {
                if (err)
                    console.error(err);

                s3bucket.createBucket(function() {
                    const params = {
                        Bucket: AWS_S3_BUCKET_NAME,
                        Key: 'wp-content/' + (new Date()).getFullYear() + '/' + obj.filename + '.mp3',
                        Body: data,
                        ACL: "public-read",
                    };
                    s3bucket.upload(params, function(err, data) {
                        if (err)
                            console.error(err);

                        obj.s3_url = data.Location;
                        obj.message = 'Succesfully converted and uploaded ' + obj.filename + '.mp3 to AWS S3.'
                        console.log('Succesfully uploaded ' + obj.filename + '.mp3 to S3!');

                        res.status(200).send(obj);
                        fs.unlinkSync(obj.filename + '.mp3');
                    });
                });
            });
        }

    });

});
