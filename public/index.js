let transactions = [];
useIndexdDB({}, 'get').then((results) => {
  transactions = results
  transactions.forEach((transaction) => {
    if (!transaction.saved) {
      saveToServer(transaction)
    }
  })
  populateTotal();
  populateTable();
  populateChart();
  console.log("index db records ==>", transactions)
})
let myChart;

fetch("/api/transaction")
  .then(response => {
    return response.json();
  })
  .then(data => {
    // save db data on global variable
    transactions = data;

    populateTotal();
    populateTable();
    populateChart();
  });

function populateTotal() {
  // reduce transaction amounts to a single total value
  let total = transactions.reduce((total, t) => {
    return total + parseInt(t.value);
  }, 0);

  let totalEl = document.querySelector("#total");
  totalEl.textContent = total;
}

function populateTable() {
  let tbody = document.querySelector("#tbody");
  tbody.innerHTML = "";

  transactions.forEach(transaction => {
    // create and populate a table row
    let tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${transaction.name}</td>
      <td>${transaction.value}</td>
    `;

    tbody.appendChild(tr);
  });
}

function populateChart() {
  // copy array and reverse it
  let reversed = transactions.slice().reverse();
  let sum = 0;

  // create date labels for chart
  let labels = reversed.map(t => {
    let date = new Date(t.date);
    return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
  });

  // create incremental values for chart
  let data = reversed.map(t => {
    sum += parseInt(t.value);
    return sum;
  });

  // remove old chart if it exists
  if (myChart) {
    myChart.destroy();
  }

  let ctx = document.getElementById("myChart").getContext("2d");

  myChart = new Chart(ctx, {
    type: 'line',
      data: {
        labels,
        datasets: [{
            label: "Total Over Time",
            fill: true,
            backgroundColor: "#6666ff",
            data
        }]
    }
  });
}

function useIndexdDB(transaction, method) {
  if (!window.indexedDB) {
    alert("Offline support is not available for this browser")
    return false;
  }

  return new Promise((resolve, reject) => {
    let object = transaction
    // let method = 'put'
    let databaseName = 'budget_tracker'
    let storeName = 'transactions'
    const request = window.indexedDB.open(databaseName, 2);
    console.log("request of indexedDB", request)

    request.onupgradeneeded = function(e) {
      console.log("upgrade needed ==>", e)
      let db = request.result;
      db.createObjectStore(storeName, { keyPath: "_id" });
    };

    request.onerror = function(e) {
      console.log("There was an error");
    };

    request.onsuccess = function(e) {
      let db = request.result;
      console.log("db and storename", db, storeName)
      let tx = db.transaction(storeName, "readwrite");
      let store = tx.objectStore(storeName);

      db.onerror = function(e) {
        console.log("error");
      };
      if (method === "put") {
        store.put(object);
      } else if (method === "get") {
        const all = store.getAll();
        all.onsuccess = function() {
          resolve(all.result);
        };
      } else if (method === "delete") {
        store.delete(object._id);
      }
      tx.oncomplete = function() {
        db.close();
      };
    };
    return true;
  })
}

function saveToServer(transaction) {
  let errorEl = document.querySelector(".form .error");

  fetch("/api/transaction", {
    method: "POST",
    body: JSON.stringify(transaction),
    headers: {
      Accept: "application/json, text/plain, */*",
      "Content-Type": "application/json"
    }
  })
  .then(response => {
    return response.json();
  })
  .then(data => {
    console.log("data is ==>", data)
    if (data.errors) {
      errorEl.textContent = "Missing Information";
    } else {
      // clear form
      transaction = {
        ...transaction,
        saved: true,
      }
      useIndexdDB(transaction, 'put');
    }
  })
  .catch(err => {
    // fetch failed, so save in indexed db
    // clear form
  });
}

function sendTransaction(isAdding) {
  let nameEl = document.querySelector("#t-name");
  let amountEl = document.querySelector("#t-amount");
  let errorEl = document.querySelector(".form .error");

  // validate form
  if (nameEl.value === "" || amountEl.value === "") {
    errorEl.textContent = "Missing Information";
    return;
  }
  else {
    errorEl.textContent = "";
  }

  // create record
  let transaction = {
    _id: transactions.length,
    name: nameEl.value,
    value: amountEl.value,
    date: new Date().toISOString(),
    saved: false,
  };

  // if subtracting funds, convert amount to negative number
  if (!isAdding) {
    transaction.value *= -1;
  }

  // add to beginning of current array of data
  transactions.unshift(transaction);

  // re-run logic to populate ui with new record
  populateChart();
  populateTable();
  populateTotal();
  
  useIndexdDB(transaction, 'put')
  saveToServer(transaction)
  
  nameEl.value = "";
  amountEl.value = "";
  // also send to server
}

document.querySelector("#add-btn").onclick = function() {
  sendTransaction(true);
};

document.querySelector("#sub-btn").onclick = function() {
  sendTransaction(false);
};
