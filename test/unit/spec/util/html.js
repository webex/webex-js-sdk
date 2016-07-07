var assert = require('chai').assert;
var html = require('../../../../src/util/html');
var skipInNode = require('../../../lib/mocha-helpers').skipInNode;

skipInNode(describe)('html()', function() {
  var allowedTags = {
    br: [],
    em: [],
    strong: [],
    a: ['style','href','type'],
    b: [],
    blockquote: ['style'],
    cite: ['style'],
    img: ['style', 'alt', 'height', 'src', 'width'],
    li: ['style'],
    ol: ['style'],
    p: ['style'],
    span: ['style'],
    ul: ['style'],
    body: ['style', 'xmlns', 'xml:lang'],
    'spark-mention': ['data-object-id', 'data-object-type']
  };

  var allowedStyles = [
    'background-color',
    'color',
    'font-family',
    'font-size',
    'font-style',
    'font-weight',
    'margin-left',
    'margin-right',
    'text-align',
    'text-decoration'
  ];

  function noop() {}

  var filter = html.filter(noop, allowedTags, allowedStyles);
  var filterSync = html.filterSync(noop, allowedTags, allowedStyles);
  var filterEscape = html.filterEscape(noop, allowedTags, allowedStyles);
  var filterEscapeSync = html.filterEscapeSync(noop, allowedTags, allowedStyles);

  describe('#filter()', function() {
    it('sanitizes trivial html', function() {
      return assert.becomes(filter('<p data-test="5"><em>foo</em></p>'), '<p><em>foo</em></p>');
    });
  });

  describe('#filterSync()', function() {
    it('sanitizes trivial html', function() {
      return assert.deepEqual(filterSync('<p data-test="5"><em>foo</em></p>'), '<p><em>foo</em></p>');
    });
  });

  [
    {
      // IE behaves differently from other browsers when DOMParser receives an
      // emptry string
      it: 'accepts blank strings',
      input: '',
      output: ''
    },
    {
      it: 'allows custom tags',
      input: '<spark-mention data-object-id="88888888-4444-4444-4444-AAAAAAAAAAAA">John Doe</spark-mention>',
      output: '<spark-mention data-object-id="88888888-4444-4444-4444-AAAAAAAAAAAA">John Doe</spark-mention>'
    },
    {
      it: 'filters tags',
      input: '<p><remove-me><bar>text1<em>text2</em>text3</bar>text4</remove-me><strong>text5</strong>text6</p>',
      output: '<p>text1<em>text2</em>text3text4<strong>text5</strong>text6</p>'
    },
    {
      it: 'filters attributes',
      input: '<p remove="me" style="font-size:large"><em>foo</em></p>',
      output: /<p style="font-size:\s?large;?"><em>foo<\/em><\/p>/
    },
    {
      it: 'filters styles',
      input: '<p style="color:red;remove:me;font-size:large"><em>foo</em></p>',
      output: /<p style="color:\s?red;\s?font-size:\s?large;?"><em>foo<\/em><\/p>/
    },
    {
      it: 'filters child attributes',
      input: '<body><span bcd="abc" style="font-size:large"><p><em>foo</em></p></span></body>',
      output: /<body><span style="font-size:\s?large;?"><p><em>foo<\/em><\/p><\/span><\/body>/
    },
    {
      it: 'filters disallowed attributes from allowed tags',
      input: '<strong style="font-size:large"><span>text</span></strong>',
      output: '<strong><span>text</span></strong>'
    },
    {
      it: 'filters javascript: from a href',
      input: '<p><a href="javascript:window.close(); return false">click here</a></p>',
      output: '<p>click here</p>'
    },
    {
      it: 'does not filter arbitrary strings from a href',
      input: '<p><a href="window.close(); return false">click here</a></p>',
      output: '<p><a href="window.close(); return false">click here</a></p>'
    },
    {
      it: 'filters javascript: from img src',
      input: '<p><img src="javascript:window.close(); return false">foo</img>bar</p>',
      output: '<p>foobar</p>'
    },
    {
      it: 'does not filter arbitrary strings from img src',
      input: '<p><img src="window.close(); return false">foo</img></p>',
      output: '<p><img src="window.close(); return false">foo</p>'
    },
    {
      it: 'correctly cleans nested a/img tags with javscript: href/src',
      input: '<p><a href="javascript:window.close()">Click here<img src="http://example.com/img">bar</img></a> for something with <a href="http://www.cisco.com/">MORE<img src="javascript:window.location=\'http://www.cisco.com\'">of my</img>MOJO</a></p>',
      output: '<p>Click here<img src="http://example.com/img">bar for something with <a href="http://www.cisco.com/">MOREof myMOJO</a></p>'
    },
    {
      it: 'handles weirder nesting',
      input: '<p>text</p><div><p>text0</p><div style="font-size: large;"><span>text1</span><span>text2</span><script></script></div></div>',
      output: '<p>text</p><p>text0</p><span>text1</span><span>text2</span>'
    },
    {
      it: 'filters bad html from unwrapped strings',
      input: 'Hi <script></script><em style="font-size:large;">Steve</em>',
      output: 'Hi <em>Steve</em>'
    },
    {
      it: 'filters disallowed attributes from a href',
      input: '<a remove="me" href="http://www.jabber.org/"><p><em>foo</em></p></a>',
      output: '<a href="http://www.jabber.org/"><p><em>foo</em></p></a>'
    },
    {
      it: 'filters disallowed attributes from a style',
      input: '<a remove="me" style="font-size:large"><p><em>foo</em></p></a>',
      output: /<a style="font-size:\s?large;?"><p><em>foo<\/em><\/p><\/a>/
    },
    {
      it: 'filters disallowed attributes from a type',
      input: '<a remove="me" type="stuff"><p><em>foo</em></p></a>',
      output: '<a type="stuff"><p><em>foo</em></p></a>'
    },
    {
      it: 'filters disallowed attributes from img src',
      input: '<img remove="me" src="http://www.xmpp.org/images/psa-license.jpg">bar</img>',
      output: '<img src="http://www.xmpp.org/images/psa-license.jpg">bar'
    },
    {
      it: 'filters disallowed attributes from img alt',
      input: '<img remove="me" alt="A License to Jabber">bar</img>',
      output: '<img alt="A License to Jabber">bar'
    },
    {
      it: 'filters disallowed attributes from img height',
      input: '<img remove="me" height="261">bar</img>',
      output: '<img height="261">bar'
    },
    {
      it: 'filters disallowed attributes from img width',
      input: '<img remove="me" width="537">bar</img>',
      output: '<img width="537">bar'
    },
    {
      it: 'esapes special characters',
      input: '<b>&<</b>',
      output: '<b>&amp;&lt;</b>'
    }
  ].forEach(function(def) {
    describe('#filter()', function() {
      it(def.it, function() {
        return filter(def.input)
          .then(function(out) {
            assert.match(out, def.output);
          });
      });
    });

    describe('#filterSync()', function() {
      it(def.it, function() {
        assert.match(filterSync(def.input), def.output);
      });
    });
  });

  [
    {
      it: 'escapes invalid tags',
      input: '<bar>text1<em>text2</em>text3</bar>',
      output: '&lt;bar&gt;text1<em>text2</em>text3&lt;/bar&gt;'
    },
    {
      it: 'escapes deeply nested invalid tags',
      input: '<p><remove-me><bar>text1<em>text2</em>text3</bar>text4</remove-me><strong>text5</strong>text6</p>',
      output: '<p>&lt;remove-me&gt;&lt;bar&gt;text1<em>text2</em>text3&lt;/bar&gt;text4&lt;/remove-me&gt;<strong>text5</strong>text6</p>'
    },
    {
      it: 'esapes special characters',
      input: '<b>&<</b>',
      output: '<b>&amp;&lt;</b>'
    }
  ].forEach(function(def) {
  describe('#filterEscape()', function() {
    it(def.it, function() {
      return filterEscape(def.input)
        .then(function(out) {
          assert.match(out, def.output);
        });
    });
  });

  describe('#filterEscapeSync()', function() {
    it(def.it, function() {
      assert.match(filterEscapeSync(def.input), def.output);
    });
  });
});


  [{
    it: 'escapes html',
    input: 'This is an <b>invalid</b> tag',
    output: 'This is an &lt;b&gt;invalid&lt;/b&gt; tag'
  }].forEach(function(def) {
    describe('#escape()', function() {
      it(def.it, function() {
        return assert.becomes(html.escape(def.input), def.output);
      });
    });

    describe('#escapeSync()', function() {
      it(def.it, function() {
        assert.deepEqual(html.escapeSync(def.input), def.output);
      });
    });
  });
});
