require('should')
paginator = require('../index');


describe('Pagination', function(){
  it('should generate pagination links', function(){
    var result = paginator.paginate(10, 5, 1);

    result.should.eql('<div class="pagination"><ul><li class="active"><a href="undefined">1</a></li>\n<li><a href="?page=2">2</a></li>\n<li><a class="next" href="?page=2">&raquo</a></li></ul></div>')
  });

  it("should be able to supply additional url parameters", function(){
    var settings = {
      add_args: {state:'VA'}
    }
    var result = paginator.paginate(10, 5, 1, settings);
   
    result.should.eql('<div class="pagination"><ul><li class="active"><a href="undefined&state=VA">1</a></li>\n<li><a href="?page=2&state=VA">2</a></li>\n<li><a class="next" href="?page=2&state=VA">&raquo</a></li></ul></div>') 
  });
});
