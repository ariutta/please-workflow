# please-workflow

Workflow helper for front-end development.

# Notes

Cannot use phash at present, due to [this issue](https://github.com/aaronm67/node-phash/issues/17),
so it's removed from `package.json`:

    `"phash": "0.0.5",`

pHash was used to create hashes of screenshots where the degree of similarity between hashes would indicate a degree of similarity between images.

We will use MD5 hashes instead, just because they are more easy to install.

perceptualdiff will be used to actually compare images and produce an output image that highlights the differences.
https://www.npmjs.com/package/perceptualdiff
