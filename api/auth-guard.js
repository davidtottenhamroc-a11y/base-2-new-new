module.exports = (req, res) => {
    // Verifica se o token de segurança existe nos cookies
    if (!req.cookies || !req.cookies.authToken) {
        res.writeHead(302, { Location: '/login.html' });
        res.end();
        return;
    }

    // Se o token existe, redireciona para a página solicitada
    res.writeHead(302, { Location: req.url });
    res.end();
};
