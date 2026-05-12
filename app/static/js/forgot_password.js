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

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  $("#forgotPasswordForm").on("submit", function (e) {
    e.preventDefault();

    const email = $("#email").val().trim();
    const securityAnswer = $("#securityAnswer").val().trim();
    const newPassword = $("#newPassword").val();
    const confirmPassword = $("#confirmPassword").val();

    if (!email || !isValidEmail(email)) {
      showAlert("Please enter a valid email address.", "danger");
      $("#email").trigger("focus");
      return;
    }
    if (!securityAnswer) {
      showAlert("Please enter your security answer.", "danger");
      $("#securityAnswer").trigger("focus");
      return;
    }

    if (!newPassword) {
      showAlert("New password is required.", "danger");
      $("#newPassword").trigger("focus");
      return;
    }
    if (newPassword.length < 8) {
      showAlert("Password must be at least 8 characters.", "danger");
      $("#newPassword").trigger("focus");
      return;
    }
    if (newPassword.length > 128) {
      showAlert("Password must be less than 128 characters.", "danger");
      $("#newPassword").trigger("focus");
      return;
    }
    if (!/[A-Z]/.test(newPassword)) {
      showAlert(
        "Password must contain at least one uppercase letter.",
        "danger",
      );
      $("#newPassword").trigger("focus");
      return;
    }
    if (!/[0-9]/.test(newPassword)) {
      showAlert("Password must contain at least one number.", "danger");
      $("#newPassword").trigger("focus");
      return;
    }

    if (newPassword !== confirmPassword) {
      showAlert("Passwords do not match.", "danger");
      $("#confirmPassword").trigger("focus");
      return;
    }

    if (newPassword !== confirmPassword) {
      showAlert("Passwords do not match.", "danger");
      $("#newPassword").trigger("focus");
      return;
    }

    const $btn = $("#resetBtn");
    $btn.addClass("loading").prop("disabled", true);
    $btn.find(".btn-label").text("Resetting…");

    $.ajax({
      url: "/api/forgot-password",
      method: "POST",
      contentType: "application/json",
      data: JSON.stringify({
        email: email,
        security_answer: securityAnswer,
        new_password: newPassword,
      }),
      success: function (response) {
        showAlert(
          "Password reset successfully! Redirecting to login…",
          "success",
        );
        setTimeout(function () {
          window.location.href = "/login";
        }, 900);
      },
      error: function (xhr) {
        let msg = "Something went wrong. Please try again.";
        if (xhr.status === 401) msg = "Email or security answer is incorrect.";
        if (xhr.status === 404) msg = "Account not found.";
        if (xhr.status === 429)
          msg = "Too many attempts. Please wait a moment.";
        showAlert(msg, "danger");
      },
      complete: function () {
        $btn.removeClass("loading").prop("disabled", false);
        $btn.find(".btn-label").text("Reset Password");
      },
    });
  });

  $("#email").trigger("focus");
});
