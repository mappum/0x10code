//
// Based on the existing Go mode (that was the easiest to break down)
// by Don Williamson
//
CodeMirror.defineMode("dcpu", function(config, parserConfig)
{
	var keywords =
	{
		"set":true, "add":true, "sub":true, "mul":true, "div":true,
		"mod":true, "shl":true, "shr":true, "and":true, "bor":true,
		"xor":true, "ife":true, "ifn":true, "ifg":true, "ifb":true,
		"jsr":true, "dat":true, "brk":true
	};

	var isOperatorChar = /[+\-:]/;

	function tokenBase(stream, state)
	{
		var ch = stream.next();

		if (ch == '"')
			return tokenString(stream, state);

		if (/[\d\.]/.test(ch))
		{
			if (ch == ".")
				stream.match(/^[0-9]+([eE][\-+]?[0-9]+)?/);
			else if (ch == "0")
				stream.match(/^[xX][0-9a-fA-F]+/) || stream.match(/^0[0-7]+/);
			else
				stream.match(/^[0-9]*\.?[0-9]*([eE][\-+]?[0-9]+)?/);

			return "number";
		}

		if (ch == ";")
		{
			stream.skipToEnd();
			return "comment";
		}

		if (isOperatorChar.test(ch))
		{
			stream.eatWhile(isOperatorChar);
			return "operator";
		}

		stream.eatWhile(/[\w\$_]/);

		var cur = stream.current();
		if (keywords.propertyIsEnumerable(cur.toLowerCase()))
			return "keyword";

		return "word";
	}

	function tokenString(stream, state)
	{
		var escaped = false, next;

		while ((next = stream.next()) != null)
		{
			if (next == '"' && !escaped)
				break;

			escaped = !escaped && next == "\\";
		}

		return "string";
	}

	return {
		token: function(stream, state)
		{
			if (stream.eatSpace())
				return null;

			return tokenBase(stream, state);
		}
	};
});