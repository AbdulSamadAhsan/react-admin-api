const { randomUUID } = require("node:crypto");
module.exports = {
    async upload(buffer, type) {
        const { put } = require("@vercel/blob");
        return put(`products/${randomUUID()}.${type.ext}`, buffer, {
            access: "public", contentType: type.mime
        });
    }
};
