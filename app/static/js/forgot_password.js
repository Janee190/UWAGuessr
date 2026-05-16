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
    $("#alertArea").html(
      '<div class="alert alert-' +
        type +
        ' alert-dismissible fade show py-2 px-3 mb-0" role="alert" style="font-size:13.5px;">' +
        message +
        '<button type="button" class="btn-close btn-sm" data-bs-dismiss="alert" aria-label="Close"></button></div>',
    );
  }

  // Find security question
  $("#fpNextBtn").on("click", function () {
    const email = $("#email").val().trim();
    if (!email) {
      showAlert("Email is required.", "danger");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showAlert("Please enter a valid email address.", "danger");
      return;
    }

    const $btn = $("#fpNextBtn");
    $btn.addClass("loading").prop("disabled", true);

    $.ajax({
      url: "/api/get-security-question",
      method: "POST",
      contentType: "application/json",
      data: JSON.stringify({ email }),
      success: function (response) {
        $("#securityQuestionText").text(response.securityQuestion);
        $("#fp-step-1").hide();
        $("#fp-step-2").show();
        $("#securityAnswer").trigger("focus");
        $("#alertArea").html("");
      },
      error: function (xhr) {
        const msg =
          xhr.responseJSON?.error || "No account found with that email.";
        showAlert(msg, "danger");
      },
      complete: function () {
        $btn.removeClass("loading").prop("disabled", false);
      },
    });
  });

  $("#fpBackBtn").on("click", function () {
    $("#fp-step-2").hide();
    $("#fp-step-1").show();
    $("#alertArea").html("");
  });

  $("#forgotPasswordForm").on("submit", function (e) {
    e.preventDefault();
    const newPassword = $("#newPassword").val();
    const confirmPassword = $("#confirmPassword").val();

    if (!$("#securityAnswer").val().trim()) {
      showAlert("Security answer is required.", "danger");
      return;
    }
    if (!newPassword) {
      showAlert("New password is required.", "danger");
      return;
    }
    if (newPassword.length < 8) {
      showAlert("Password must be at least 8 characters.", "danger");
      return;
    }
    if (!/[A-Z]/.test(newPassword)) {
      showAlert(
        "Password must contain at least one uppercase letter.",
        "danger",
      );
      return;
    }
    if (!/[0-9]/.test(newPassword)) {
      showAlert("Password must contain at least one number.", "danger");
      return;
    }
    if (newPassword !== confirmPassword) {
      showAlert("Passwords do not match.", "danger");
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
        email: $("#email").val().trim(),
        securityAnswer: $("#securityAnswer").val().trim(),
        newPassword,
      }),
      success: function () {
        showAlert("Password reset! Redirecting…", "success");
        setTimeout(() => {
          window.location.href = "/login";
        }, 1200);
      },
      error: function (xhr) {
        const msg =
          xhr.responseJSON?.error || "Something went wrong. Please try again.";
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
