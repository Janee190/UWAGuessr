$(function () {
  const NUM_PINS = 5;
  const MARGIN = 20,
    W = 340,
    H = 520;
  const SVG_NS = "http://www.w3.org/2000/svg";
  const PIN_COLOURS = [
    "#E24B4A",
    "#185FA5",
    "#8B3FBF",
    "#F2C94C",
    "#000000",
    "#FF2D55",
    "#00C7FF",
    "#FF8C00",
    "#FFD700",
    "#FF1493",
  ];

  function makeSVGEl(tag, attrs) {
    const el = document.createElementNS(SVG_NS, tag);
    $.each(attrs, function (k, v) {
      el.setAttribute(k, v);
    });
    return el;
  }

  const svg = $("svg")[0];
  for (let i = 0; i < NUM_PINS; i++) {
    const cx = MARGIN + Math.random() * (W - MARGIN * 2);
    const cy = MARGIN + 18 + Math.random() * (H - MARGIN * 2 - 18);
    const colour = PIN_COLOURS[Math.floor(Math.random() * PIN_COLOURS.length)];
    const g = document.createElementNS(SVG_NS, "g");
    g.setAttribute("class", "pin");
    g.style.animationDelay = i * 0.3 + "s";
    g.appendChild(makeSVGEl("circle", { cx: cx, cy: cy, r: 11, fill: colour }));
    g.appendChild(
      makeSVGEl("polygon", {
        points:
          cx +
          "," +
          (cy + 18) +
          " " +
          (cx - 7) +
          "," +
          (cy + 8) +
          " " +
          (cx + 7) +
          "," +
          (cy + 8),
        fill: colour,
      }),
    );
    g.appendChild(
      makeSVGEl("circle", { cx: cx, cy: cy, r: 4.5, fill: "white" }),
    );
    svg.appendChild(g);
  }

<<<<<<< HEAD
  function showAlert(message, type) {
    const html =
      '<div class="alert alert-' +
      type +
      ' alert-dismissible fade show py-2 px-3 mb-0" role="alert" style="font-size:13.5px;">' +
      message +
      '<button type="button" class="btn-close btn-sm" data-bs-dismiss="alert" aria-label="Close"></button>' +
      "</div>";
    $("#alertArea").html(html);
  }

  $("#signupForm").on("submit", function (e) {
    e.preventDefault();

    const username = $("#username").val().trim();
    const email = $("#email").val().trim();
    const password = $("#password").val();
    const confirmPassword = $("#confirmPassword").val();
    const securityQuestion = $("#securityQuestion").val().trim();
    const securityAnswer = $("#securityAnswer").val().trim();

    if (!username) {
      showAlert("Please enter a username.", "danger");
      $("#username").trigger("focus");
      return;
    }
    if (username.length < 3) {
      showAlert("Username must be at least 3 characters.", "danger");
      $("#username").trigger("focus");
      return;
    }
    if (username.length > 80) {
      showAlert("Username must be less than 80 characters.", "danger");
      $("#username").trigger("focus");
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      showAlert(
        "Username can only contain letters, numbers and underscores.",
        "danger",
      );
      $("#username").trigger("focus");
      return;
    }

    if (!email) {
      showAlert("Please enter an email address.", "danger");
      $("#email").trigger("focus");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showAlert("Please enter a valid email address.", "danger");
      $("#email").trigger("focus");
      return;
    }
    if (email.length > 120) {
      showAlert("Email must be less than 120 characters.", "danger");
      $("#email").trigger("focus");
      return;
    }

    if (!password) {
      showAlert("Please enter a password.", "danger");
      $("#password").trigger("focus");
      return;
    }
    if (password.length < 8) {
      showAlert("Password must be at least 8 characters.", "danger");
      $("#password").trigger("focus");
      return;
    }
    if (password.length > 128) {
      showAlert("Password must be less than 128 characters.", "danger");
      $("#password").trigger("focus");
      return;
    }
    if (!/[A-Z]/.test(password)) {
      showAlert(
        "Password must contain at least one uppercase letter.",
        "danger",
      );
      $("#password").trigger("focus");
      return;
    }
    if (!/[0-9]/.test(password)) {
      showAlert("Password must contain at least one number.", "danger");
      $("#password").trigger("focus");
      return;
    }

    if (password !== confirmPassword) {
      showAlert("Passwords do not match.", "danger");
      $("#confirmPassword").trigger("focus");
      return;
    }

    if (!securityQuestion) {
      showAlert("Please enter a security question.", "danger");
      $("#securityQuestion").trigger("focus");
      return;
    }
    if (securityQuestion.length > 256) {
      showAlert(
        "Security question must be less than 256 characters.",
        "danger",
      );
      $("#securityQuestion").trigger("focus");
      return;
    }
    if (!securityAnswer) {
      showAlert("Please enter a security answer.", "danger");
      $("#securityAnswer").trigger("focus");
      return;
    }

    const $btn = $("#signupBtn");
    $btn.addClass("loading").prop("disabled", true);
    $btn.find(".btn-label").text("Creating account…");

    $.ajax({
      url: "/api/signup",
      method: "POST",
      contentType: "application/json",
      data: JSON.stringify({
        username: username,
        email: email,
        password: password,
        securityQuestion: securityQuestion,
        securityAnswer: securityAnswer,
      }),
      success: function (response) {
        showAlert("Account created! Redirecting…", "success");
        setTimeout(function () {
          window.location.href = response.redirect || "/login";
        }, 900);
      },
      error: function (xhr) {
        let msg = "Something went wrong. Please try again.";
        if (xhr.responseJSON && xhr.responseJSON.errors) {
          const errors = xhr.responseJSON.errors;
          msg = errors.username || errors.email || errors.password || msg;
        }
        if (xhr.status === 409) msg = "Email or username already taken";
        showAlert(msg, "danger");
      },
      complete: function () {
        $btn.removeClass("loading").prop("disabled", false);
        $btn.find(".btn-label").text("Create account");
      },
    });
  });

  $("#guestBtn").on("click", function () {
    sessionStorage.setItem("guest", "true");
    window.location.href = "/";
=======
  // ── Helpers ────────────────────────────────────────────────────────────
  function showAlert(message, type) {
    $("#alertArea").html(
      '<div class="alert alert-' +
        type +
        ' alert-dismissible fade show py-2 px-3 mb-0" role="alert" style="font-size:13.5px;">' +
        message +
        '<button type="button" class="btn-close btn-sm" data-bs-dismiss="alert" aria-label="Close"></button></div>',
    );
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function goToStep(step) {
    $(".form-step").hide();
    $("#step-" + step).show();
    for (let i = 1; i <= 3; i++) {
      const $ind = $("#step-ind-" + i);
      $ind.removeClass("active complete");
      if (i < step) $ind.addClass("complete");
      if (i === step) $ind.addClass("active");
    }
    $(".step-connector").each(function (i) {
      $(this).toggleClass("complete", i + 1 < step);
    });
    $("#alertArea").html("");
  }

  // Strength meter
  $("#password").on("input", function () {
    const pw = $(this).val();
    const hasLen = pw.length >= 8;
    const hasUpper = /[A-Z]/.test(pw);
    const hasNum = /[0-9]/.test(pw);
    let score = [hasLen, hasUpper, hasNum, pw.length >= 12].filter(
      Boolean,
    ).length;

    $("#req-len").toggleClass("met", hasLen);
    $("#req-upper").toggleClass("met", hasUpper);
    $("#req-num").toggleClass("met", hasNum);

    const widths = ["0%", "33%", "66%", "85%", "100%"];
    const colours = ["", "#e74c3c", "#f39c12", "#3498db", "#28a745"];
    const labels = ["", "Weak", "Fair", "Good", "Strong"];
    $("#strengthBar").css({ width: widths[score], background: colours[score] });
    $("#strengthLabel")
      .text(score > 0 ? labels[score] : "")
      .css("color", colours[score]);
  });

  // Step 1
  $("#nextBtn1").on("click", function () {
    const username = $("#username").val().trim();
    const email = $("#email").val().trim();
    if (!username) {
      showAlert("Username is required.", "danger");
      $("#username").trigger("focus");
      return;
    }
    if (username.length < 3) {
      showAlert("Username must be at least 3 characters.", "danger");
      $("#username").trigger("focus");
      return;
    }
    if (username.length > 80) {
      showAlert("Username must be less than 80 characters.", "danger");
      $("#username").trigger("focus");
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      showAlert(
        "Username can only contain letters, numbers and underscores.",
        "danger",
      );
      $("#username").trigger("focus");
      return;
    }
    if (!email) {
      showAlert("Email is required.", "danger");
      $("#email").trigger("focus");
      return;
    }
    if (!isValidEmail(email)) {
      showAlert("Please enter a valid email address.", "danger");
      $("#email").trigger("focus");
      return;
    }
    if (email.length > 120) {
      showAlert("Email must be less than 120 characters.", "danger");
      $("#email").trigger("focus");
      return;
    }
    goToStep(2);
    $("#password").trigger("focus");
  });

  // Step 2
  $("#backBtn2").on("click", function () {
    goToStep(1);
  });

  $("#nextBtn2").on("click", function () {
    const password = $("#password").val();
    const confirmPassword = $("#confirmPassword").val();
    if (!password) {
      showAlert("Password is required.", "danger");
      $("#password").trigger("focus");
      return;
    }
    if (password.length < 8) {
      showAlert("Password must be at least 8 characters.", "danger");
      $("#password").trigger("focus");
      return;
    }
    if (password.length > 128) {
      showAlert("Password must be less than 128 characters.", "danger");
      $("#password").trigger("focus");
      return;
    }
    if (!/[A-Z]/.test(password)) {
      showAlert(
        "Password must contain at least one uppercase letter.",
        "danger",
      );
      $("#password").trigger("focus");
      return;
    }
    if (!/[0-9]/.test(password)) {
      showAlert("Password must contain at least one number.", "danger");
      $("#password").trigger("focus");
      return;
    }
    if (password !== confirmPassword) {
      showAlert("Passwords do not match.", "danger");
      $("#confirmPassword").trigger("focus");
      return;
    }
    goToStep(3);
    $("#securityQuestion").trigger("focus");
  });

  // Submit
  $("#backBtn3").on("click", function () {
    goToStep(2);
  });

  $("#signupForm").on("submit", function (e) {
    e.preventDefault();
    const securityQuestion = $("#securityQuestion").val().trim();
    const securityAnswer = $("#securityAnswer").val().trim();
    if (!securityQuestion) {
      showAlert("Please enter a security question.", "danger");
      $("#securityQuestion").trigger("focus");
      return;
    }
    if (securityQuestion.length > 200) {
      showAlert(
        "Security question must be less than 200 characters.",
        "danger",
      );
      $("#securityQuestion").trigger("focus");
      return;
    }
    if (!securityAnswer) {
      showAlert("Please enter your security answer.", "danger");
      $("#securityAnswer").trigger("focus");
      return;
    }

    const $btn = $("#signupBtn");
    $btn.addClass("loading").prop("disabled", true);
    $btn.find(".btn-label").text("Creating account…");

    $.ajax({
      url: "/api/signup",
      method: "POST",
      contentType: "application/json",
      data: JSON.stringify({
        username: $("#username").val().trim(),
        email: $("#email").val().trim(),
        password: $("#password").val(),
        securityQuestion: securityQuestion,
        securityAnswer: securityAnswer,
      }),
      success: function (response) {
        showAlert("Account created! Redirecting…", "success");
        setTimeout(function () {
          window.location.href = response.redirect || "/";
        }, 900);
      },
      error: function (xhr) {
        let msg = "Something went wrong. Please try again.";
        if (xhr.responseJSON && xhr.responseJSON.errors) {
          const errors = xhr.responseJSON.errors;
          msg =
            errors.username ||
            errors.email ||
            errors.password ||
            errors.securityQuestion ||
            errors.securityAnswer ||
            msg;
          if (errors.username || errors.email) goToStep(1);
          else if (errors.password) goToStep(2);
        }
        if (xhr.status === 409) msg = "Email or username already taken.";
        showAlert(msg, "danger");
      },
      complete: function () {
        $btn.removeClass("loading").prop("disabled", false);
        $btn.find(".btn-label").text("Start playing");
      },
    });
  });

  // Guest button
  $("#guestBtn").on("click", function () {
    sessionStorage.setItem("guest", "true");
    window.location.href = "/game";
>>>>>>> 6b406ca9f8609626b8bee0dc101c4f0fd51ed192
  });

  $("#username").trigger("focus");
});
