   // main.go
   package main

   import (
       "encoding/json"
       "net/http"
   )

   // Response structure
   type Response struct {
       Message string `json:"message"`
   }

   // Handler function
   func helloHandler(w http.ResponseWriter, r *http.Request) {
       response := Response{Message: "Hello, World!"}
       w.Header().Set("Content-Type", "application/json")
       json.NewEncoder(w).Encode(response)
   }

   func main() {
       http.HandleFunc("/hello", helloHandler)
       http.ListenAndServe(":8080", nil)
   }