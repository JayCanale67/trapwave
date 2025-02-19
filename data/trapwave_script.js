document.addEventListener("DOMContentLoaded", () => {
  //set up all the user inputs
  function setupUI() {
    var vintageMake = [];
    data["trap_Wave"].forEach((element) => {
      var temp = element["Insulation_Class"] + "*" + element["Name"];
      if (!vintageMake.includes(temp) && temp != "") {
        vintageMake.push(temp);
      }
    });

    //combobox displaying the make and vintage
    var vintageMakeComboxList = document.getElementById("vintageMakeCombo");
    vintageMake.sort((a, b) => a - b);
    vintageMake.sort().forEach((element) => {
      var option = document.createElement("option");
      option.value = element;
      option.text = element;
      vintageMakeComboxList.onchange = () => calculate();
      vintageMakeComboxList.appendChild(option);
    });
    vintageMakeComboxList.selectedIndex = 8;

    //combobox displaying the calculation methods
    var methodComboxList = document.getElementById("methodCombo");
    var option = document.createElement("option");
    option.value = "PJM Method";
    option.text = "PJM Method";
    methodComboxList.onchange = () => calculate();
    methodComboxList.appendChild(option);
    option = document.createElement("option");
    option.value = "NY-Tie Method";
    option.text = "NY-Tie Method";
    methodComboxList.onchange = () => calculate();
    methodComboxList.appendChild(option);

    //apply NY Tie checkbox
    var applyNYTieCheckbox = document.getElementById("applyNYTieCheckbox");
    applyNYTieCheckbox.checked = false;
    applyNYTieCheckbox.className = "mr-2";
    applyNYTieCheckbox.onchange = () => calculate();

    // nameplate input 
    var nameplate = document.getElementById("namePlateInput");
    nameplate.setAttribute("type", "number");
    nameplate.setAttribute("text", "2000");
    nameplate.setAttribute("value", "2000");
    nameplate.setAttribute("min", "0");
    nameplate.setAttribute("max", "10000");
    nameplate.setAttribute("step", "1.0");
    nameplate.onchange = () => calculate();

    // elevation input
    var elevation = document.getElementById("elevationInput");
    elevation.setAttribute("type", "number");
    elevation.setAttribute("text", "0");
    elevation.setAttribute("value", "0");
    elevation.setAttribute("min", "0");
    elevation.setAttribute("max", "10000");
    elevation.setAttribute("step", "1.0");
    elevation.onchange = () => calculate();
  }

  //gather all the user information and perform
  //the calculation
  function calculate() {
    var Rise;
    var MOT;
    var Emergency_Greater_24hr;
    var Emergency_Less_24hr;
    //get the name and vintage from the combobox
    var trapMakeInput = document.getElementById("vintageMakeCombo");
    var temp = trapMakeInput.options[trapMakeInput.selectedIndex].value.split("*");
    let curve = [
      110, 110, 110, 110, 110, 110, 110, 110, 110, 110, 110, 110, 110, 110, 110,
      109.4, 108.6, 107.8, 107.1, 106.5, 105.8, 105.2, 104.6, 103.9, 103.3,
      102.6, 101.9, 101.1, 100.3, 99.4, 98.4, 97.3, 96.1, 94.7,
    ];
    let tempsF = [
      -40, -35, -30, -25, -20, -15, -10, -5, 0, 5, 10, 15, 20, 25, 30, 35, 40,
      45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110, 115, 120, 125,
    ]; // degrees F as a column extracted from their plot

    //clear messages
    //document.getElementById("message1").innerHTML = "";
    //document.getElementById("message2").innerHTML = "";
    //document.getElementById("inputData").innerHTML = "";

    //search in the JSON file for matching Vintage and Name
    //once found gather the remaining information
    data["trap_Wave"].forEach((element) => {
      var name = temp[1];
      var vintage = temp[0];
      if (element["Name"] == name && element["Insulation_Class"] == vintage) {
        //assemble the data
        Rise = parseFloat(element["Max_Rise_at_Normal_Load"]);
        MOT = parseFloat(element["MOT"]);
        Emergency_Greater_24hr = parseFloat(element["Emergency_Greater_24hr"]);
        Emergency_Less_24hr = parseFloat(element["Emergency_Less_24hr"]);
      }
    });
    
    var applyNYTieCheckbox = document.getElementById("applyNYTieCheckbox");
    var NYtieCAP = applyNYTieCheckbox.checked;
    var nameplate = parseFloat(document.getElementById("namePlateInput").value);
    var methodInput = document.getElementById("methodCombo");
    var method = methodInput.selectedIndex;

    // Create the range of air temperatures in F for display, but calculations must be done in C
    // from -40 to 125F in 5F steps, create an array and convert it from deg F to deg C
    var AT = f2c([...Array(34).keys()].map((x) => x * 5 - 40)); 
    var He = parseFloat(document.getElementById("elevationInput").value);
    
    // These are flags for later corrections
    var AltitudeFactor, MaxAT;
    if (He < 1000) {
      // should probably be a switch but this works
      AltitudeFactor = 1;
      MaxAT = 40;
    } else if (He < 1500) {
      AltitudeFactor = 0.99;
      MaxAT = 37;
    } else {
      AltitudeFactor = 0.96;
      MaxAT = 30;
    }
    var I = new Array(AT.length).fill(0); // creates a placeholder array for the result "Rating in Amps"
    
    //echo the input to the screen
    //document.getElementById("inputData").innerHTML = trapMakeInput.options[trapMakeInput.selectedIndex].value + ", MOT: " + MOT + ", Rise: " + Rise + ", Nameplate: " + nameplate+ ", MaxAT: " + MaxAT+ ", He: " + He+ ", Altitude Factor: " + AltitudeFactor;

    //PJM Method
    if (method === 0) {
      let n = 2.0; // this is the n constant we had before it does not need to be displayed
      var delta = [];
      for (var i = 0; i < AT.length; i++) {
        delta[i] = MOT - AT[i];
      }

      for (var i = 0; i < delta.length; i++) {
        if (delta[i] > 0) {
          I[i] = nameplate * Math.pow(Math.abs(MOT - AT[i]) / Rise, 1 / n);
        } else {
          I[i] = 0;
        }
      }
    } else {
      // NY-Tie Method
      var factors = curve.map((factor) => factor / 100.0); // convert from percentage to a multiplier - this gets multiplied by nameplate, column extracted from their plot

      for (let i = 0; i < AT.length; i++) {
        //I[i] = interp1(tempsF, factors, (AT[i] * 9) / 5 + 32, "spline"); //<- old way
        // If the air temperature is a value between two  points in their curve, interpolate the value
        I[i] = nameplate * factors[i] * AltitudeFactor;
      }

      if (Math.max(...AT) > 40) {
        // I extended the curve they provided, we want to warn against using my data in that range
        document.getElementById("message1").innerHTML =
          "Data extrapolated beyond known curve - may contain errors";
      }
    }
    // Elevation Factor
    I = I.map((i) => i * AltitudeFactor); // from the earlier elseif block
    // Rating in amps
    if (NYtieCAP) {
      I = I.map((i) => (i > 1.1 * nameplate ? 1.1 * nameplate : i)); // if cap checkbox selected, for all values where rating(I) is more than 110% of the nameplate, set it to 110% of the nameplate
    }

    // if (Math.max(...AT) > MaxAT) {
    //   // if peak air temperature in our range goes above the allowed correction curve throw a warning
    //   document.getElementById("message2").innerHTML =
    //     "Warning, may be above valid range for local altitude";
    // }

    if (nameplate < 100) {
      I = I.map((i) => Math.round(i * 100) / 100); // round to 2 decimal places if nameplate is under 100
    } else {
      I = I.map((i) => Math.round(i)); // round to 0 decimal places otherwise
    }
    document.getElementById("output").innerHTML = "";
    console.log(I);

    const displayDiv = document.getElementById('output');
    // Convert the array to a string and display it
    //displayDiv.innerHTML = I.join(', ');
 
    PlotData(tempsF, I);
  }

  function f2c(f) {
    var data = [];
    for (var x = 0; x < f.length; x++) {
      data[x] = ((f[x] - 32) * 5) / 9;
    }
    return data;
  }

  function PlotData(factors, I) {
    var data = [
      {
        type: "scatter",
        x: factors,
        y: I,
        mode: "lines",
        name: "Blue",
        line: {
          color: "rgb(219, 64, 82)",
          width: 3,
        },
      },
    ];
    var layout = {
      title: "Wave Trap Rating",
      xaxis: {
        title: "Air Temperature °F",
        range: [-50, 130], // This ensures that the y-axis includes zero
        automargin: true,
        linewidth: "1",
        linecolor: "black",
        mirror: true,
        dtick: 10,
      },
      yaxis: {
        title: "Current (A)",
        automargin: true,
        linewidth: "1",
        linecolor: "black",
        mirror: true,
        rangemode: "tozero",
      },
    };
    const config = {
      displayModeBar: false, // this is the line that hides the bar.
      responsive: true,
    };
    Plotly.newPlot("myChart", data, layout, config);
  }

  window.onload = function () {
    setupUI();
    calculate();
    console.log("startup");
  };
});
