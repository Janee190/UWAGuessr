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
  });

  $("#username").trigger("focus");
});
