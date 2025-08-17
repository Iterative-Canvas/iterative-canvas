FROM node:22

# 1. Fix this starship bug: https://github.com/starship/starship/issues/5881
# 2. Install curl and tree
RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends locales curl tree; \
    sed -i 's/# *en_US.UTF-8 UTF-8/en_US.UTF-8 UTF-8/' /etc/locale.gen; \
    locale-gen en_US.UTF-8; \
    update-locale LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8; \
    rm -rf /var/lib/apt/lists/*

ENV LANG=en_US.UTF-8
ENV LC_ALL=en_US.UTF-8

# Starship once, in the image
RUN curl -sS https://starship.rs/install.sh | sh -s -- --yes \
    && echo 'eval "$(starship init bash)"' >> /etc/bash.bashrc

WORKDIR /workspace
