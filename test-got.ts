const got = require("got");
async function run() {
  try {
    const res = await got("http://127.0.0.1:3001");
    console.log("Success:", res.statusCode);
  } catch (err) {
    console.log("Error:", err.message);
  }
}
run();
