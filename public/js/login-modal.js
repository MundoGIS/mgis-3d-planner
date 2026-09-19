document.addEventListener('DOMContentLoaded', function () {
  var loginBtn = document.getElementById('loginBtn');
  if (loginBtn) {
    loginBtn.addEventListener('click', function () {
      var modal = document.getElementById('loginModal');
      if (modal) {
        modal.classList.add('is-active');
      }
    });
  }

  var loginModal = document.getElementById('loginModal');
  if (!loginModal) {
    return;
  }

  document.querySelectorAll('#loginModal .delete, #cancelLoginButton').forEach(function (element) {
    element.addEventListener('click', function () {
      loginModal.classList.remove('is-active');
    });
  });
});