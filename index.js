
// eslint-disable-next-line no-global-assign
require = require( "esm" )( module/*, options*/ );
module.exports = require( process.env.FILE || "./main.js" ).default;
