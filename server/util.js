//////////////////////////////////////////////
//	Constructor + property set/gets
//////////////////////////////////////////////

//UTIL class
function UTIL() {
}

UTIL.prototype.matchAny = function(a, b) {
	
	if (typeof a == 'object' && a instanceof Array) {
		for (var i = 0; i < a.length; i++)
			if (a[i] != b) return true;
		
		return false;
	} else return false;
	
}

//Expose UTIL class
module.exports = UTIL;