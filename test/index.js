import { effect, reactive } from "../reactivity/index.js";

let arr = reactive([]);
effect(() => {
  console.log(arr.length);
});
effect(() => {
  arr.push(1);
});
effect(() => {
  arr.push(1);
});
effect(() => {
  arr.push(1);
});
console.log(arr);
