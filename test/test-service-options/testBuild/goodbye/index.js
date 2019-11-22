(function (e, a) { for (const i in a) e[i] = a[i]; }(exports, /** *** */ (function (modules) { // webpackBootstrap
/** *** */ 	// The module cache
/** *** */ 	const installedModules = {};

  /** *** */ 	// The require function
  /** *** */ 	function __webpack_require__(moduleId) {
    /** *** */ 		// Check if module is in cache
    /** *** */ 		if (installedModules[moduleId])
    /** *** */ 			{ return installedModules[moduleId].exports; }

    /** *** */ 		// Create a new module (and put it into the cache)
    /** *** */ 		const module = installedModules[moduleId] = {
      /** *** */ 			exports: {},
      /** *** */ 			id: moduleId,
      /** *** */ 			loaded: false,
      /** *** */ 		};

    /** *** */ 		// Execute the module function
    /** *** */ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);

    /** *** */ 		// Flag the module as loaded
    /** *** */ 		module.loaded = true;

    /** *** */ 		// Return the exports of the module
    /** *** */ 		return module.exports;
    /** *** */ 	}


  /** *** */ 	// expose the modules object (__webpack_modules__)
  /** *** */ 	__webpack_require__.m = modules;

  /** *** */ 	// expose the module cache
  /** *** */ 	__webpack_require__.c = installedModules;

  /** *** */ 	// __webpack_public_path__
  /** *** */ 	__webpack_require__.p = '';

  /** *** */ 	// Load entry module and return exports
  /** *** */ 	return __webpack_require__(0);
/** *** */ }([
/* 0 */
/** */ (function (module, exports, __webpack_require__) {
    module.exports = __webpack_require__(1);
    /** */ }),
  /* 1 */
  /** */ (function (module, exports) {
    'use strict';

    module.exports.handler = (event, context, callback) => {
	  const response = {
	    statusCode: 200,
	    body: JSON.stringify({
	      message: 'Go Serverless v1.0! Your function executed successfully!',
	      input: event,
	    }),
	  };

	  callback(null, response);

	  // Use this code if you don't use the http event with the LAMBDA-PROXY integration
	  // callback(null, { message: 'Go Serverless v1.0! Your function executed successfully!', event });
    };
    /** */ }),
/** *** */ ]))));
