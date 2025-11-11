// describe('Math functions',()=>{

//     it('should return 4 when adding 2 and 2',()=>{
//         expect(2+2).toBe(4);
//     });

//     it('should return 0 when subtracting 2 from 2',()=> {
//         expect(2-2).toBe(0);
//     });
// });
describe('Test Suite Description', () => {
  beforeAll(() => {
    console.log('Running before all tests');
  });

  beforeEach(() => {
    console.log('Running before each test');
  });

  afterEach(() => {
    console.log('Running after each test');
  });

  afterAll(() => {
    console.log('Running after all tests');
  });

  it('Should 1 + 1 equal to 2', () => {
    expect(1 + 1).toBe(2);
  });
});