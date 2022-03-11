import { effect, reactive } from "../reactivity/index.js";

let arr = reactive([1, 2, 3, 4, 5]);
effect(() => {
  for (const val of arr) {
    console.log(val);
  }
});
arr[0] = "bar";
arr.length = 2;
