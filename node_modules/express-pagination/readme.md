# express-pagination
This is a super simple module to provide a pagination helper function in
your views. Code is derived from the pagination logic found in
wordpress.

## Using It
Add the module 'express-pagination' to your package.json and refresh
your dependencies via npm. 

Set it up in your app via:

```javascript
app.helpers(require('pagination'));

```

or 

```javascript
app.helpers({
  paginate:require('pagination').paginate
});

```

And use it from your view (given the following locals are defined).

!= paginate(count, resultsPerPage, currentPage)

## License 

This software is licensed under the GNU Public License. See COPYING for
further details.
